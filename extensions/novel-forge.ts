import type { PiExtensionApi } from "../src/pi/types.js";
import { registerNovelForge } from "../src/pi/extension.js";

export default function novelForgeExtension(pi: PiExtensionApi): void {
  registerNovelForge(pi);
}
