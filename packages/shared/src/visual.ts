export interface VisualComparisonProvider {
  compare(referencePath: string, implementationPath: string): Promise<{ score: number; diffPath?: string }>;
}

export const visualVerificationStatus = "planned" as const;
