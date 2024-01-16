declare module 'oniyi-vcard-parser' {
  type ExtensionAttribute = { id: string; key: string; value: string; dataType?: string };
  export type ParsedVCard<T> = T & {
    [key: string]: string;
    extattr: ExtensionAttribute[];
    tags?: string | string[];
  };

  declare class OniyiVcardParser<T> {
    constructor(options: {
      vCardToJSONAttributeMapping: Record<string, string>;
      complexJSONAttributes: Record<string, string[]>;
    });

    toObject(vCardStr: string, encode = false): ParsedVCard<T>;
    toVcard(vCard: ParsedVCard<T>, validAttributes: string[]);
  }

  export = OniyiVcardParser;
}
