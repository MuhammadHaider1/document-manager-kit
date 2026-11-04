import ReactMarkdown from 'react-markdown'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

/**
 * Answers are model output, so they are treated as untrusted: react-markdown
 * renders no raw HTML and rehype-sanitize strips dangerous URLs/elements.
 * `dangerouslySetInnerHTML` is never used.
 */
const schema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
  },
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      ['target', '_blank'],
      ['rel', 'noopener noreferrer nofollow'],
    ],
  },
}

export function MarkdownAnswer({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('prose-legal', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
