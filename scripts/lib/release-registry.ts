import type { ReleaseCheck } from "./release-check.js";
import { verifyV13ReleaseTree } from "../verify-v1-3-release.js";
import { verifyV14ReleaseTree } from "../verify-v1-4-release.js";
import { verifyV15ReleaseTree } from "../verify-v1-5-release.js";
import { verifyV161ReleaseTree } from "../verify-v1-6-1-release.js";
import { verifyV162ReleaseTree } from "../verify-v1-6-2-release.js";
import { verifyV17ReleaseTree } from "../verify-v1-7-release.js";
import { verifyV171ReleaseTree } from "../verify-v1-7-1-release.js";
import { verifyV172ReleaseTree } from "../verify-v1-7-2-release.js";
import { verifyV173ReleaseTree } from "../verify-v1-7-3-release.js";
import { verifyV174ReleaseTree } from "../verify-v1-7-4-release.js";
import { verifyV180ReleaseTree } from "../verify-v1-8-0-release.js";
import { verifyV190ReleaseTree } from "../verify-v1-9-0-release.js";
import { verifyV191ReleaseTree } from "../verify-v1-9-1-release.js";
import { verifyV1100ReleaseTree } from "../verify-v1-10-0-release.js";
import { verifyV200ReleaseTree } from "../verify-v2-0-0-release.js";
import { verifyV201ReleaseTree } from "../verify-v2-0-1-release.js";
import { verifyV210ReleaseTree } from "../verify-v2-1-0-release.js";
import { verifyV220ReleaseTree } from "../verify-v2-2-0-release.js";
import { verifyV221ReleaseTree } from "../verify-v2-2-1-release.js";

export interface ReleaseRegistryEntry {
  version: string;
  verify: (root: string) => ReleaseCheck[];
}

/**
 * One entry per shipped release, oldest first. Each `verify` function is that
 * release's own frozen check set, unchanged — adding a release means adding
 * one entry here and nothing else. The entry whose version matches the
 * installed NOVEL_FORGE_VERSION is the one required to pass completely;
 * every other entry is a historical record, expected to report itself
 * superseded (its own `package-version` check fails) rather than to pass.
 */
export const RELEASE_REGISTRY: ReleaseRegistryEntry[] = [
  { version: "1.3.0", verify: verifyV13ReleaseTree },
  { version: "1.4.2", verify: verifyV14ReleaseTree },
  { version: "1.5.0", verify: verifyV15ReleaseTree },
  { version: "1.6.1", verify: verifyV161ReleaseTree },
  { version: "1.6.2", verify: verifyV162ReleaseTree },
  { version: "1.7.0", verify: verifyV17ReleaseTree },
  { version: "1.7.1", verify: verifyV171ReleaseTree },
  { version: "1.7.2", verify: verifyV172ReleaseTree },
  { version: "1.7.3", verify: verifyV173ReleaseTree },
  { version: "1.7.4", verify: verifyV174ReleaseTree },
  { version: "1.8.0", verify: verifyV180ReleaseTree },
  { version: "1.9.0", verify: verifyV190ReleaseTree },
  { version: "1.9.1", verify: verifyV191ReleaseTree },
  { version: "1.10.0", verify: verifyV1100ReleaseTree },
  { version: "2.0.0", verify: verifyV200ReleaseTree },
  { version: "2.0.1", verify: verifyV201ReleaseTree },
  { version: "2.1.0", verify: verifyV210ReleaseTree },
  { version: "2.2.0", verify: verifyV220ReleaseTree },
  { version: "2.2.1", verify: verifyV221ReleaseTree },
];
