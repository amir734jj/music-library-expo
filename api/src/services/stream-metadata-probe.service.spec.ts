import { describe, expect, it } from "vitest";

import { normalizeStreamMetadata } from "./stream-metadata-probe.service.js";

describe("normalizeStreamMetadata", () => {
  it("extracts StreamTitle and rejects leaked ICY fields", () => {
    expect(normalizeStreamMetadata(
      "StreamTitle='.113FM-BeRightBack!';StreamUrl='';StreamArtwork='';",
      undefined,
      "StreamTitle='.113FM-BeRightBack!';StreamUrl='';StreamArtwork='';",
    )).toEqual({
      artist: null,
      raw: ".113FM-BeRightBack!",
      title: null,
    });
  });

  it("preserves parsed artist and title metadata", () => {
    expect(normalizeStreamMetadata(
      "StreamTitle='The Artist - The Song';StreamUrl='';",
      " The Artist ",
      " The Song ",
    )).toEqual({
      artist: "The Artist",
      raw: "The Artist - The Song",
      title: "The Song",
    });
  });
});