import type { AdoptionPreview } from "./types.js";

export class AdoptionPreviewStore {
  private readonly previews = new Map<string, AdoptionPreview>();

  put(preview: AdoptionPreview): string {
    this.previews.set(preview.previewId, preview);
    return preview.previewId;
  }

  get(previewId: string): AdoptionPreview {
    const preview = this.previews.get(previewId);
    if (!preview) throw new Error(`Unknown or expired adoption preview: ${previewId}`);
    return preview;
  }

  delete(previewId: string): void { this.previews.delete(previewId); }
  clear(): void { this.previews.clear(); }
}
