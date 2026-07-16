import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerNovelForgeWithRecalibration } from "../src/pi/recalibration-extension.js";

export default function novelForgeExtension(pi: ExtensionAPI): void {
  registerNovelForgeWithRecalibration(pi);
}
