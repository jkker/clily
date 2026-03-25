declare module 'omelette' {
  export interface OmeletteInstance {
    tree(tree: Record<string, unknown>): OmeletteInstance
    generateCompletionCode(): string
    generateCompletionCodeFish(): string
  }

  export default function omelette(program: string): OmeletteInstance
}
