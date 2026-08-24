// Types for the vendored kuromoji build (see scripts/patch-kuromoji.mjs).
// Mirrors the @types/kuromoji surface used by tokenize.ts.
import type kuromoji from 'kuromoji';

declare const kuromojiApi: {
  builder(options: { dicPath: string }): {
    build(
      callback: (err: Error | null, tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures>) => void,
    ): void;
  };
  dictionaryBuilder(): unknown;
};

export = kuromojiApi;
