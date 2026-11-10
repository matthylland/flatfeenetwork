import { Transform, type TransformCallback } from "node:stream";

/** Read the encoding named in an XML declaration, e.g. <?xml version="1.0" encoding="ISO-8859-1"?>. */
export function declaredEncoding(head: string): string | null {
  const decl = head.match(/^﻿?<\?xml[^?]*\?>/);
  const enc = decl?.[0].match(/encoding\s*=\s*["']([^"']+)["']/i);
  return enc ? enc[1] : null;
}

/**
 * Turn XML bytes into text using the encoding the file declares (UTF-8 when it
 * declares none). The SEC feeds declare ISO-8859-1, which a UTF-8 reader would
 * reject or garble, so we decode before handing text to the parser.
 */
export function xmlTextDecoder(): Transform {
  let decoder: TextDecoder | null = null;
  let pending = Buffer.alloc(0);

  const start = () => {
    // The declaration is plain ASCII, so reading it as latin1 is safe whatever the encoding.
    const name = declaredEncoding(pending.subarray(0, 512).toString("latin1")) ?? "utf-8";
    try {
      decoder = new TextDecoder(name);
    } catch {
      throw new Error(`Unsupported XML encoding: ${name}`);
    }
  };

  return new Transform({
    readableObjectMode: false,
    decodeStrings: true,
    transform(chunk: Buffer, _enc, cb: TransformCallback) {
      try {
        if (!decoder) {
          pending = Buffer.concat([pending, chunk]);
          // Wait until the whole declaration has arrived (or clearly isn't there).
          if (pending.length < 512 && !pending.includes("?>")) return cb();
          start();
          chunk = pending;
          pending = Buffer.alloc(0);
        }
        cb(null, decoder!.decode(chunk, { stream: true }));
      } catch (err) {
        cb(err as Error);
      }
    },
    flush(cb: TransformCallback) {
      try {
        if (!decoder) {
          start();
          cb(null, decoder!.decode(pending));
        } else cb(null, decoder.decode());
      } catch (err) {
        cb(err as Error);
      }
    },
  });
}
