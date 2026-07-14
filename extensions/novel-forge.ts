import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerNovelForge } from "../src/pi/extension.js";
export default function novelForgeExtension(pi: ExtensionAPI): void { registerNovelForge(pi); }
