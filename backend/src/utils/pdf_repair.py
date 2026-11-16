"""Repair broken ``/ToUnicode`` maps so ligatures extract correctly.

Some PDF producers subset CID fonts (``/Encoding /Identity-H``) but leave the
ligature CIDs (``fi``/``fl``/``ff``/``ffi``/``ffl``) mapped to ``U+0000`` in the
font's ``/ToUnicode`` CMap. Text extractors then emit a NUL (pypdf) or
``U+FFFE`` (PDFium) where a ligature should be, silently corrupting words such
as "flames" or "affluence" — and, because Postgres rejects NUL, sometimes
failing the whole ingestion.

The information needed to recover the ligature is still inside the embedded
font program, so this module rebuilds the broken entries before extraction:

1. A bad CID is resolved from the font program by following its composite
   glyph components until one of them is mapped, via the font ``cmap``, to a
   ligature presentation form (``U+FB00``-``U+FB06``). This resolves
   ``ffi``/``ffl``/``ff``.
2. If that fails, the CID's advance width is matched against the widths of the
   font's ligature presentation forms (unambiguous for ``fi``/``fl`` in most
   fonts).
3. Sibling subset fonts in the same document share the same glyph ids, so a
   ligature resolved in one font fills the same CID in the others. This covers
   the remaining ``fi``/``fl`` cases whose widths collide.

Only the ``/ToUnicode`` stream is touched, and the rewritten document is used
solely for text extraction; the stored file is never modified. Any failure
returns the input bytes unchanged, so extraction degrades gracefully.
"""

from __future__ import annotations

import io
import logging
import re
import struct

from pypdf import PdfReader, PdfWriter

logger = logging.getLogger(__name__)

# Unicode ligature presentation forms -> their plain-text expansion.
_LIGATURES = {
    0xFB00: "ff",
    0xFB01: "fi",
    0xFB02: "fl",
    0xFB03: "ffi",
    0xFB04: "ffl",
    0xFB05: "st",
    0xFB06: "st",
}

# A CID that maps to U+0000 is the "missing ligature" signature we repair.
_BAD_MAPPING_RE = re.compile(r"<([0-9A-Fa-f]{4})>\s*<0000>")
_BFCHAR_BLOCK_RE = re.compile(r"beginbfchar(.*?)endbfchar", re.S)
_BFRANGE_BLOCK_RE = re.compile(r"beginbfrange(.*?)endbfrange", re.S)


def repair_pdf(pdf_bytes: bytes) -> bytes:
    """Return ``pdf_bytes`` with ligature holes in ``/ToUnicode`` filled in.

    Returns the input untouched when there is nothing to repair or when the
    document cannot be parsed, so callers can use it unconditionally.
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        fonts = list(_iter_broken_fonts(reader))
        if not fonts:
            return pdf_bytes

        # Resolve each font's bad CIDs, then let fonts fill each other's gaps.
        per_font: dict[int, dict[int, str]] = {}
        for key, _font, program, bad in fonts:
            per_font[key] = _resolve_cids(program, bad)
        shared: dict[int, str] = {}
        for mapping in per_font.values():
            for cid, ligature in mapping.items():
                shared.setdefault(cid, ligature)

        changed = False
        for key, font, _program, bad in fonts:
            final = dict(per_font[key])
            for cid in bad:
                final.setdefault(cid, shared.get(cid))
            if not any(final.get(cid) for cid in bad):
                continue
            stream = font["/ToUnicode"]
            text = stream.get_data().decode("latin-1")
            repaired = _replace_bad_entries(text, final)
            if repaired != text:
                stream.set_data(repaired.encode("latin-1"))
                changed = True

        if not changed:
            return pdf_bytes

        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        buffer = io.BytesIO()
        writer.write(buffer)
        return buffer.getvalue()
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("PDF ligature repair skipped: %s", exc)
        return pdf_bytes


def _iter_broken_fonts(reader: PdfReader):
    """Yield ``(key, font, font_program, bad_cids)`` for subset fonts to fix."""
    seen: set[int] = set()
    for page in reader.pages:
        resources = page.get("/Resources")
        fonts = resources.get("/Font") if resources else None
        if not fonts:
            continue
        for name in fonts:
            font = fonts[name].get_object()
            if font.get("/Subtype") != "/Type0":
                continue
            reference = getattr(font, "indirect_reference", None)
            key = reference.idnum if reference else id(font)
            if key in seen:
                continue
            seen.add(key)
            stream = font.get("/ToUnicode")
            if stream is None:
                continue
            bad = sorted(
                {
                    int(m, 16)
                    for m in _BAD_MAPPING_RE.findall(
                        stream.get_data().decode("latin-1")
                    )
                }
            )
            if not bad:
                continue
            program = _font_program(font)
            if program is None:
                continue
            yield key, font, program, bad


def _font_program(font) -> bytes | None:
    descendants = font.get("/DescendantFonts")
    if not descendants:
        return None
    descriptor = descendants[0].get_object().get("/FontDescriptor")
    if descriptor is None:
        return None
    descriptor = descriptor.get_object()
    for name in ("/FontFile2", "/FontFile3", "/FontFile"):
        if name in descriptor:
            return descriptor[name].get_data()
    return None


def _replace_bad_entries(cmap_text: str, resolved: dict[int, str]) -> str:
    def substitute(match: re.Match[str]) -> str:
        cid = int(match.group(1), 16)
        ligature = resolved.get(cid)
        if not ligature:
            return match.group(0)
        expansion = "".join(f"{ord(char):04X}" for char in ligature)
        return f"<{match.group(1)}> <{expansion}>"

    return _BAD_MAPPING_RE.sub(substitute, cmap_text)


def _resolve_cids(program: bytes, bad: list[int]) -> dict[int, str]:
    try:
        font = _TrueTypeFont(program)
    except Exception:  # pragma: no cover - malformed font
        return {}
    resolved: dict[int, str] = {}
    for cid in bad:
        ligature = font.ligature_from_components(cid) or font.ligature_from_width(cid)
        if ligature:
            resolved[cid] = ligature
    return resolved


class _TrueTypeFont:
    """Minimal reader for the ``glyf``/``cmap``/``hmtx`` tables we need."""

    def __init__(self, data: bytes):
        self.data = data
        tables = self._tables(data)
        head = tables["head"][0]
        self.loc_format = struct.unpack(">h", data[head + 50 : head + 52])[0]
        maxp = tables["maxp"][0]
        self.num_glyphs = struct.unpack(">H", data[maxp + 4 : maxp + 6])[0]
        self.loca = tables["loca"][0]
        self.glyf = tables["glyf"][0]
        hhea = tables["hhea"][0]
        self.num_hmetrics = struct.unpack(">H", data[hhea + 34 : hhea + 36])[0]
        self.hmtx = tables["hmtx"][0]
        self.unicode_to_gid = self._cmap(tables["cmap"][0])
        self.gid_to_unicode: dict[int, int] = {}
        for codepoint, gid in self.unicode_to_gid.items():
            self.gid_to_unicode.setdefault(gid, codepoint)

    @staticmethod
    def _tables(data: bytes) -> dict[str, tuple[int, int]]:
        count = struct.unpack(">H", data[4:6])[0]
        tables: dict[str, tuple[int, int]] = {}
        for index in range(count):
            offset = 12 + index * 16
            tag = data[offset : offset + 4].decode("latin-1")
            start, length = struct.unpack(">II", data[offset + 8 : offset + 16])
            tables[tag] = (start, length)
        return tables

    def advance_width(self, gid: int) -> int:
        if gid < self.num_hmetrics:
            return struct.unpack(
                ">H", self.data[self.hmtx + 4 * gid : self.hmtx + 4 * gid + 2]
            )[0]
        last = self.hmtx + 4 * (self.num_hmetrics - 1)
        return struct.unpack(">H", self.data[last : last + 2])[0]

    def _glyph_offset(self, gid: int) -> tuple[int, int]:
        if self.loc_format == 0:
            start = (
                struct.unpack(
                    ">H", self.data[self.loca + 2 * gid : self.loca + 2 * gid + 2]
                )[0]
                * 2
            )
            end = (
                struct.unpack(
                    ">H", self.data[self.loca + 2 * gid + 2 : self.loca + 2 * gid + 4]
                )[0]
                * 2
            )
        else:
            start = struct.unpack(
                ">I", self.data[self.loca + 4 * gid : self.loca + 4 * gid + 4]
            )[0]
            end = struct.unpack(
                ">I", self.data[self.loca + 4 * gid + 4 : self.loca + 4 * gid + 8]
            )[0]
        return self.glyf + start, self.glyf + end

    def glyph(self, gid: int) -> bytes:
        start, end = self._glyph_offset(gid)
        return self.data[start:end]

    def components(self, gid: int) -> list[int]:
        """Component glyph ids of a composite glyph (empty if not composite)."""
        data = self.glyph(gid)
        if len(data) < 10 or struct.unpack(">h", data[0:2])[0] != -1:
            return []
        offset = 10
        out: list[int] = []
        while offset + 4 <= len(data):
            flags, component_gid = struct.unpack(">HH", data[offset : offset + 4])
            offset += 4
            offset += 4 if flags & 0x0001 else 2  # ARG_1_AND_2_ARE_WORDS
            if flags & 0x0008:  # WE_HAVE_A_SCALE
                offset += 2
            elif flags & 0x0040:  # WE_HAVE_AN_X_AND_Y_SCALE
                offset += 4
            elif flags & 0x0080:  # WE_HAVE_A_TWO_BY_TWO
                offset += 8
            out.append(component_gid)
            if not flags & 0x0020:  # MORE_COMPONENTS
                break
        return out

    def ligature_from_components(self, gid: int) -> str | None:
        """Follow composite components to a glyph mapped to a ligature form."""
        seen: set[int] = set()
        stack = [gid]
        while stack:
            current = stack.pop(0)
            if current in seen:
                continue
            seen.add(current)
            codepoint = self.gid_to_unicode.get(current)
            if codepoint in _LIGATURES:
                return _LIGATURES[codepoint]
            stack.extend(self.components(current))
        return None

    def ligature_from_width(self, gid: int) -> str | None:
        """Match the CID's advance width against the ligature presentation forms."""
        width = self.advance_width(gid)
        matches = {
            _LIGATURES[codepoint]
            for codepoint in _LIGATURES
            if codepoint in self.unicode_to_gid
            and self.advance_width(self.unicode_to_gid[codepoint]) == width
        }
        return matches.pop() if len(matches) == 1 else None

    def _cmap(self, cmap_offset: int) -> dict[int, int]:
        count = struct.unpack(">H", self.data[cmap_offset + 2 : cmap_offset + 4])[0]
        mapping: dict[int, int] = {}
        for index in range(count):
            record = cmap_offset + 4 + index * 8
            _platform, _encoding, subtable = struct.unpack(
                ">HHI", self.data[record : record + 8]
            )
            try:
                mapping.update(self._subtable(cmap_offset + subtable))
            except Exception:  # pragma: no cover - tolerate odd subtables
                continue
        return mapping

    def _subtable(self, offset: int) -> dict[int, int]:
        fmt = struct.unpack(">H", self.data[offset : offset + 2])[0]
        if fmt == 4:
            return self._subtable_format4(offset)
        if fmt == 12:
            return self._subtable_format12(offset)
        return {}

    def _subtable_format4(self, offset: int) -> dict[int, int]:
        seg_count = struct.unpack(">H", self.data[offset + 6 : offset + 8])[0] // 2
        ends = struct.unpack(
            ">" + "H" * seg_count, self.data[offset + 14 : offset + 14 + 2 * seg_count]
        )
        starts_at = offset + 16 + 2 * seg_count
        starts = struct.unpack(
            ">" + "H" * seg_count, self.data[starts_at : starts_at + 2 * seg_count]
        )
        deltas_at = starts_at + 2 * seg_count
        deltas = struct.unpack(
            ">" + "h" * seg_count, self.data[deltas_at : deltas_at + 2 * seg_count]
        )
        ranges_at = deltas_at + 2 * seg_count
        ranges = struct.unpack(
            ">" + "H" * seg_count, self.data[ranges_at : ranges_at + 2 * seg_count]
        )

        mapping: dict[int, int] = {}
        for index in range(seg_count):
            for codepoint in range(starts[index], min(ends[index], 0xFFFF) + 1):
                if ranges[index] == 0:
                    gid = (codepoint + deltas[index]) & 0xFFFF
                else:
                    glyph_at = (
                        ranges_at
                        + 2 * index
                        + ranges[index]
                        + 2 * (codepoint - starts[index])
                    )
                    if glyph_at + 2 > len(self.data):
                        continue
                    gid = struct.unpack(">H", self.data[glyph_at : glyph_at + 2])[0]
                    if gid:
                        gid = (gid + deltas[index]) & 0xFFFF
                if gid:
                    mapping[codepoint] = gid
        return mapping

    def _subtable_format12(self, offset: int) -> dict[int, int]:
        groups = struct.unpack(">I", self.data[offset + 12 : offset + 16])[0]
        mapping: dict[int, int] = {}
        for index in range(groups):
            record = offset + 16 + index * 12
            start, end, start_gid = struct.unpack(
                ">III", self.data[record : record + 12]
            )
            for step, codepoint in enumerate(range(start, end + 1)):
                mapping[codepoint] = start_gid + step
        return mapping


__all__ = ["repair_pdf"]
