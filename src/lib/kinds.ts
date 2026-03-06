export const ASSET_KINDS = ["tal", "dance", "act", "performer"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const CREATABLE_ASSET_KINDS = ["tal", "dance", "act", "performer"] as const;
export type CreatableAssetKind = (typeof CREATABLE_ASSET_KINDS)[number];

const ASSET_KIND_SET = new Set<string>(ASSET_KINDS);
const CREATABLE_ASSET_KIND_SET = new Set<string>(CREATABLE_ASSET_KINDS);

export const isAssetKind = (value: string): value is AssetKind =>
  ASSET_KIND_SET.has(value);

export const isCreatableAssetKind = (value: string): value is CreatableAssetKind =>
  CREATABLE_ASSET_KIND_SET.has(value);
