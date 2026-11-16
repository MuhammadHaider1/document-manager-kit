"""Tests for the PDF ligature repair.

These build a tiny synthetic TrueType program (composite glyph, ligature
presentation forms, ``cmap``/``hmtx``/``glyf``/``loca`` tables) so the resolver
can be exercised without shipping a fixture font, then wrap it in a Type0 font
whose ``/ToUnicode`` maps a CID to ``U+0000`` — the exact defect seen in the
wild.
"""

from __future__ import annotations

import io
import struct

import pytest
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
)

from src.utils.pdf_repair import _TrueTypeFont, _replace_bad_entries, repair_pdf

# cmap: ligature presentation form -> glyph id
_CMAP = {0xFB01: 0x40, 0xFB02: 0x41, 0xFB03: 0x42, 0xFB04: 0x43, 0xFB00: 0x44}
# advance widths: fi and fl deliberately collide (500) to force the ambiguity.
_WIDTHS = {0x40: 500, 0x41: 500, 0x42: 700, 0x43: 800, 0x44: 900}
_NUM_GLYPHS = 0x60


def _simple_glyph() -> bytes:
    # numberOfContours=1 + bbox; the parser only needs the 10-byte header.
    return struct.pack(">hhhhh", 1, 0, 0, 500, 700)


def _composite_glyph(component: int) -> bytes:
    header = struct.pack(">hhhhh", -1, 0, 0, 500, 700)
    # ARG_1_AND_2_ARE_WORDS, single component (no MORE_COMPONENTS).
    record = struct.pack(">HHhh", 0x0001, component, 0, 0)
    return header + record


def _format4(mapping: dict[int, int]) -> bytes:
    segments = [(code, code, gid) for code, gid in sorted(mapping.items())]
    segments.append((0xFFFF, 0xFFFF, 0))
    seg_count = len(segments)
    ends = [s[1] for s in segments]
    starts = [s[0] for s in segments]
    deltas = [(s[2] - s[0]) & 0xFFFF for s in segments]
    ranges = [0] * seg_count
    search_range = 2 * (2 ** (seg_count.bit_length() - 1))
    entry_selector = seg_count.bit_length() - 1
    range_shift = 2 * seg_count - search_range
    length = 16 + 8 * seg_count
    header = struct.pack(
        ">HHHHHHH",
        4,
        length,
        0,
        seg_count * 2,
        search_range,
        entry_selector,
        range_shift,
    )
    payload = (
        struct.pack(">" + "H" * seg_count, *ends)
        + struct.pack(">H", 0)
        + struct.pack(">" + "H" * seg_count, *starts)
        + struct.pack(">" + "H" * seg_count, *deltas)
        + struct.pack(">" + "H" * seg_count, *ranges)
    )
    return header + payload


def _build_font(glyphs: dict[int, bytes], widths: dict[int, int]) -> bytes:
    glyf = bytearray()
    loca: list[int] = []
    for gid in range(_NUM_GLYPHS):
        loca.append(len(glyf))
        glyf += glyphs.get(gid, b"")
        while len(glyf) % 4:
            glyf += b"\x00"
    loca.append(len(glyf))
    glyf = bytes(glyf)

    head = bytearray(54)
    struct.pack_into(">i", head, 0, 0x00010000)
    struct.pack_into(">h", head, 50, 0)  # indexToLocFormat = short

    maxp = bytearray(32)
    struct.pack_into(">i", maxp, 0, 0x00010000)
    struct.pack_into(">H", maxp, 4, _NUM_GLYPHS)

    hhea = bytearray(36)
    struct.pack_into(">H", hhea, 34, _NUM_GLYPHS)  # numberOfHMetrics

    hmtx = b"".join(
        struct.pack(">Hh", widths.get(gid, 0), 0) for gid in range(_NUM_GLYPHS)
    )
    loca_bytes = b"".join(struct.pack(">H", offset // 2) for offset in loca)

    cmap = struct.pack(">HHHHI", 0, 1, 3, 1, 12) + _format4(_CMAP)

    tables = {
        b"cmap": cmap,
        b"glyf": glyf,
        b"head": bytes(head),
        b"hhea": bytes(hhea),
        b"hmtx": hmtx,
        b"loca": loca_bytes,
        b"maxp": bytes(maxp),
    }
    return _assemble(tables)


def _assemble(tables: dict[bytes, bytes]) -> bytes:
    tags = sorted(tables)
    num = len(tags)
    search_range = 2 * (2 ** (num.bit_length() - 1))
    header = struct.pack(
        ">IHHHH",
        0x00010000,
        num,
        search_range,
        num.bit_length() - 1,
        num * 16 - search_range,
    )
    offset = 12 + num * 16
    records = b""
    body = b""
    for tag in tags:
        data = tables[tag]
        records += struct.pack(">4sIII", tag, 0, offset, len(data))
        padded = data + b"\x00" * (-len(data) % 4)
        body += padded
        offset += len(padded)
    return header + records + body


def _synthetic_font() -> bytes:
    glyphs = {
        0x50: _composite_glyph(0x42),  # -> ffi via component
        0x51: _simple_glyph(),  # width 700 -> ffi
        0x52: _simple_glyph(),  # width 500 -> fi/fl ambiguous
        0x53: _composite_glyph(0x59),  # component not in cmap -> falls back to width
    }
    widths = dict(_WIDTHS)
    widths[0x51] = 700
    widths[0x52] = 500
    widths[0x53] = 900
    return _build_font(glyphs, widths)


def test_resolves_ligature_through_composite_components():
    font = _TrueTypeFont(_synthetic_font())
    assert font.ligature_from_components(0x50) == "ffi"


def test_resolves_ligature_by_advance_width():
    font = _TrueTypeFont(_synthetic_font())
    assert font.ligature_from_width(0x51) == "ffi"
    assert font.ligature_from_width(0x53) == "ff"


def test_ambiguous_width_returns_none():
    font = _TrueTypeFont(_synthetic_font())
    assert font.ligature_from_width(0x52) is None


def test_replace_bad_entries_expands_multi_character_ligatures():
    cmap = "<0279> <0000>\n<027D> <0000>\n<0003> <0020>\n"
    result = _replace_bad_entries(cmap, {0x0279: "fi", 0x027D: "ffi"})
    assert "<0279> <00660069>" in result
    assert "<027D> <006600660069>" in result
    assert "<0003> <0020>" in result
    assert "<0000>" not in result


def test_repair_pdf_returns_input_when_nothing_to_fix():
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buffer = io.BytesIO()
    writer.write(buffer)
    original = buffer.getvalue()
    assert repair_pdf(original) == original


def _broken_font_pdf(font_bytes: bytes, bad_cid: int = 0x50) -> bytes:
    writer = PdfWriter()
    page = writer.add_blank_page(width=200, height=200)

    font_file = DecodedStreamObject()
    font_file.set_data(font_bytes)
    font_file_ref = writer._add_object(font_file)

    descriptor = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/FontDescriptor"),
            NameObject("/FontName"): NameObject("/TestFont"),
            NameObject("/Flags"): NumberObject(4),
            NameObject("/FontBBox"): ArrayObject([NumberObject(0)] * 4),
            NameObject("/ItalicAngle"): NumberObject(0),
            NameObject("/Ascent"): NumberObject(800),
            NameObject("/Descent"): NumberObject(-200),
            NameObject("/CapHeight"): NumberObject(700),
            NameObject("/StemV"): NumberObject(80),
            NameObject("/FontFile2"): font_file_ref,
        }
    )
    descriptor_ref = writer._add_object(descriptor)

    descendant = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/CIDFontType2"),
            NameObject("/BaseFont"): NameObject("/TestFont"),
            NameObject("/CIDToGIDMap"): NameObject("/Identity"),
            NameObject("/FontDescriptor"): descriptor_ref,
            NameObject("/DW"): NumberObject(1000),
        }
    )
    descendant_ref = writer._add_object(descendant)

    tounicode = DecodedStreamObject()
    tounicode.set_data(f"<0003> <0020>\n<{bad_cid:04X}> <0000>\n".encode("latin-1"))
    tounicode_ref = writer._add_object(tounicode)

    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type0"),
            NameObject("/BaseFont"): NameObject("/TestFont"),
            NameObject("/Encoding"): NameObject("/Identity-H"),
            NameObject("/DescendantFonts"): ArrayObject([descendant_ref]),
            NameObject("/ToUnicode"): tounicode_ref,
        }
    )
    font_ref = writer._add_object(font)

    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_ref})}
    )

    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def test_repair_pdf_fills_broken_tounicode_end_to_end():
    pdf = _broken_font_pdf(_synthetic_font(), bad_cid=0x50)
    repaired = repair_pdf(pdf)
    assert repaired != pdf

    reader = PdfReader(io.BytesIO(repaired))
    font = reader.pages[0]["/Resources"]["/Font"]["/F1"].get_object()
    cmap = font["/ToUnicode"].get_data().decode("latin-1")
    assert "<0050> <006600660069>" in cmap
    assert "<0050> <0000>" not in cmap
    assert "<0003> <0020>" in cmap


def test_repair_pdf_survives_unparseable_input():
    garbage = b"not a pdf at all"
    assert repair_pdf(garbage) == garbage


@pytest.mark.parametrize("bad_cid", [0x51, 0x53])
def test_repair_pdf_uses_width_fallback(bad_cid: int):
    pdf = _broken_font_pdf(_synthetic_font(), bad_cid=bad_cid)
    repaired = repair_pdf(pdf)
    reader = PdfReader(io.BytesIO(repaired))
    cmap = (
        reader.pages[0]["/Resources"]["/Font"]["/F1"]
        .get_object()["/ToUnicode"]
        .get_data()
        .decode("latin-1")
    )
    expected = "006600660069" if bad_cid == 0x51 else "00660066"
    assert f"<{bad_cid:04X}> <{expected}>" in cmap
