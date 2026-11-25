import { generateBundleCandidates, type CandidateOptions } from "./candidates.ts";
import {
  ALIGNMENT_ALGORITHM_VERSION,
  type AlignmentCandidateGroup,
  type AlignmentInputBundle,
  type VerseCandidateResult,
} from "./contracts.ts";

/** A deterministic offline result. Every group remains a candidate, including
 * those absent from the priority review queue; this is never published data. */
export type AlignmentPipelineResult = {
  readonly status: "candidate";
  readonly algorithmVersion: string;
  readonly translationId: string;
  readonly originalEditionId: string;
  readonly lexiconIndexDigest: string | null;
  readonly versificationMapVersion: string;
  readonly verses: readonly VerseCandidateResult[];
  readonly reviewQueue: readonly AlignmentCandidateGroup[];
};

export function runAlignmentPipeline(
  bundle: AlignmentInputBundle,
  options?: CandidateOptions,
): AlignmentPipelineResult {
  const verses = generateBundleCandidates(bundle, options);
  return {
    status: "candidate",
    algorithmVersion: ALIGNMENT_ALGORITHM_VERSION,
    translationId: bundle.translationId,
    originalEditionId: bundle.originalEditionId,
    lexiconIndexDigest: bundle.lexiconIndexDigest,
    versificationMapVersion: bundle.versificationMapVersion,
    verses,
    reviewQueue: verses.flatMap((verse) => verse.groups.filter((group) => group.needsReview)),
  };
}
