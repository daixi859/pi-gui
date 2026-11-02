import { useState, type ReactNode } from 'react'
import { galleryBlocks, gallerySections, type GallerySection } from '../mock'
import { TranscriptStack } from './blocks'

/** 开发期块画廊：左导航 + 右预览 */
export function Gallery(): ReactNode {
  const [active, setActive] = useState<GallerySection>('user')
  return (
    <div className="flex h-full">
      <nav className="w-[212px] shrink-0 overflow-y-auto border-r border-line py-3">
        {gallerySections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(s.id)}
            className={
              'block w-full px-4 py-1.5 text-left text-[12.5px] transition-colors hover:bg-sunken ' +
              (s.id === active ? 'font-medium text-fg' : 'text-muted')
            }
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px] px-8 py-6">
          <TranscriptStack blocks={galleryBlocks[active]} />
        </div>
      </div>
    </div>
  )
}
