import type { ReactNode } from 'react'
import { ComposerCard, SuggestionRow } from './Composer'
import { PiWatermark } from '../base/PiLogo'

/** 起始页：水印 + 问候 + 大输入卡 + 建议胶囊（设计稿第二张） */
export function StartPage({ onSubmit }: { onSubmit: (text: string) => void }): ReactNode {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 pb-16">
      <div className="-mb-2 select-none">
        <PiWatermark />
      </div>
      <h1 className="mb-8 text-2xl leading-tight font-semibold tracking-tight">
        上午好呀，有什么想让我帮忙的吗
      </h1>
      <div className="w-full max-w-[672px]">
        <ComposerCard scope="new" onSubmit={onSubmit} />
        <SuggestionRow onPick={onSubmit} />
      </div>
    </div>
  )
}
