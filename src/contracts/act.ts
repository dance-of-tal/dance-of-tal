import {
  assertBaseAssetShape,
  safeParse,
  isRecord,
  isNonEmptyString,
  parseDotAssetUrn,
} from "./asset-base.js";
import type { DotAssetBase, ParseResult } from "./asset-base.js";

export const ACT_ASSET_SCHEMA =
  "https://schemas.danceoftal.com/assets/act.v1.json" as const;

export type ActParticipantSubscriptionsV1 = {
  messagesFrom?: string[];
  messageTags?: string[];
  callboardKeys?: string[];
  eventTypes?: string[];
};

export type ActParticipantV1 = {
  id: string;
  performer: string;
  activeDances?: string[];
  subscriptions?: ActParticipantSubscriptionsV1;
};

export type ActRelationPermissionsV1 = {
  callboardKeys?: string[];
  messageTags?: string[];
};

export type ActRelationV1 = {
  id: string;
  between: [string, string];
  direction?: "both" | "one-way";
  name: string;
  description?: string;
  permissions?: ActRelationPermissionsV1;
  maxCalls?: number;
  timeout?: number;
  sessionPolicy?: "fresh" | "reuse";
};

export type ActAssetPayloadV1 = {
  actRules?: string[];
  participants: ActParticipantV1[];
  relations: ActRelationV1[];
};

export type ActAssetV1 = DotAssetBase<"act", ActAssetPayloadV1>;

function parseOptionalStringArray(
  input: unknown,
  fieldName: string,
): string[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) {
    throw new Error(`${fieldName} must be an array of strings when provided`);
  }
  return Array.from(
    new Set(
      input.map((entry, index) => {
        if (!isNonEmptyString(entry)) {
          throw new Error(`${fieldName}[${index}] must be a non-empty string`);
        }
        return entry;
      }),
    ),
  );
}

function parseSubscriptions(
  input: unknown,
  fieldName: string,
): ActParticipantSubscriptionsV1 {
  if (!isRecord(input)) {
    throw new Error(`${fieldName} must be an object when provided`);
  }
  return {
    ...(parseOptionalStringArray(input.messagesFrom, `${fieldName}.messagesFrom`)
      ? { messagesFrom: parseOptionalStringArray(input.messagesFrom, `${fieldName}.messagesFrom`) }
      : {}),
    ...(parseOptionalStringArray(input.messageTags, `${fieldName}.messageTags`)
      ? { messageTags: parseOptionalStringArray(input.messageTags, `${fieldName}.messageTags`) }
      : {}),
    ...(parseOptionalStringArray(input.callboardKeys, `${fieldName}.callboardKeys`)
      ? { callboardKeys: parseOptionalStringArray(input.callboardKeys, `${fieldName}.callboardKeys`) }
      : {}),
    ...(parseOptionalStringArray(input.eventTypes, `${fieldName}.eventTypes`)
      ? { eventTypes: parseOptionalStringArray(input.eventTypes, `${fieldName}.eventTypes`) }
      : {}),
  };
}

function parseParticipant(input: unknown, index: number): ActParticipantV1 {
  if (!isRecord(input)) {
    throw new Error(`payload.participants[${index}] must be an object`);
  }
  if (!isNonEmptyString(input.id)) {
    throw new Error(`payload.participants[${index}].id must be a non-empty string`);
  }
  if (!isNonEmptyString(input.performer)) {
    throw new Error(`payload.participants[${index}].performer must be a non-empty string`);
  }

  parseDotAssetUrn(input.performer, "performer");

  let activeDances: string[] | undefined;
  if (input.activeDances !== undefined) {
    if (!Array.isArray(input.activeDances)) {
      throw new Error(`payload.participants[${index}].activeDances must be an array`);
    }
    activeDances = Array.from(
      new Set(
        input.activeDances.map((entry, danceIndex) => {
          try {
            parseDotAssetUrn(entry, "dance");
          } catch (error) {
            const message = error instanceof Error ? error.message : "invalid dance urn";
            throw new Error(
              `payload.participants[${index}].activeDances[${danceIndex}] ${message}`,
            );
          }
          return entry;
        }),
      ),
    );
  }

  return {
    id: input.id,
    performer: input.performer,
    ...(activeDances ? { activeDances } : {}),
    ...(input.subscriptions !== undefined
      ? { subscriptions: parseSubscriptions(input.subscriptions, `payload.participants[${index}].subscriptions`) }
      : {}),
  };
}

function parsePermissions(input: unknown, fieldName: string): ActRelationPermissionsV1 {
  if (!isRecord(input)) {
    throw new Error(`${fieldName} must be an object when provided`);
  }
  return {
    ...(parseOptionalStringArray(input.callboardKeys, `${fieldName}.callboardKeys`)
      ? { callboardKeys: parseOptionalStringArray(input.callboardKeys, `${fieldName}.callboardKeys`) }
      : {}),
    ...(parseOptionalStringArray(input.messageTags, `${fieldName}.messageTags`)
      ? { messageTags: parseOptionalStringArray(input.messageTags, `${fieldName}.messageTags`) }
      : {}),
  };
}

function parseRelation(input: unknown, index: number): ActRelationV1 {
  if (!isRecord(input)) {
    throw new Error(`payload.relations[${index}] must be an object`);
  }
  if (!isNonEmptyString(input.id)) {
    throw new Error(`payload.relations[${index}].id must be a non-empty string`);
  }
  if (!Array.isArray(input.between) || input.between.length !== 2) {
    throw new Error(`payload.relations[${index}].between must be a 2-item string tuple`);
  }
  const between = input.between.map((entry, betweenIndex) => {
    if (!isNonEmptyString(entry)) {
      throw new Error(
        `payload.relations[${index}].between[${betweenIndex}] must be a non-empty string`,
      );
    }
    return entry;
  }) as [string, string];

  if (input.direction !== undefined && input.direction !== "both" && input.direction !== "one-way") {
    throw new Error(`payload.relations[${index}].direction must be 'both' or 'one-way' when provided`);
  }
  if (!isNonEmptyString(input.name)) {
    throw new Error(`payload.relations[${index}].name must be a non-empty string`);
  }
  if (input.description !== undefined && typeof input.description !== "string") {
    throw new Error(`payload.relations[${index}].description must be a string when provided`);
  }
  const maxCalls = input.maxCalls;
  if (
    maxCalls !== undefined &&
    (typeof maxCalls !== "number" || !Number.isInteger(maxCalls) || maxCalls < 1)
  ) {
    throw new Error(`payload.relations[${index}].maxCalls must be an integer >= 1 when provided`);
  }
  const timeout = input.timeout;
  if (
    timeout !== undefined &&
    (typeof timeout !== "number" || !Number.isInteger(timeout) || timeout < 1)
  ) {
    throw new Error(`payload.relations[${index}].timeout must be an integer >= 1 when provided`);
  }
  if (
    input.sessionPolicy !== undefined &&
    input.sessionPolicy !== "fresh" &&
    input.sessionPolicy !== "reuse"
  ) {
    throw new Error(
      `payload.relations[${index}].sessionPolicy must be 'fresh' or 'reuse' when provided`,
    );
  }

  return {
    id: input.id,
    between,
    name: input.name,
    ...(input.direction ? { direction: input.direction } : {}),
    ...(typeof input.description === "string" ? { description: input.description } : {}),
    ...(input.permissions !== undefined
      ? { permissions: parsePermissions(input.permissions, `payload.relations[${index}].permissions`) }
      : {}),
    ...(typeof maxCalls === "number" ? { maxCalls } : {}),
    ...(typeof timeout === "number" ? { timeout } : {}),
    ...(input.sessionPolicy ? { sessionPolicy: input.sessionPolicy } : {}),
  };
}

export function parseActAsset(input: unknown): ActAssetV1 {
  const base = assertBaseAssetShape(input, "act", ACT_ASSET_SCHEMA);

  const actRules = parseOptionalStringArray(base.payload.actRules, "payload.actRules");

  if (!Array.isArray(base.payload.participants)) {
    throw new Error("payload.participants must be an array");
  }
  if (!Array.isArray(base.payload.relations)) {
    throw new Error("payload.relations must be an array");
  }

  const participants = base.payload.participants.map((entry, index) =>
    parseParticipant(entry, index),
  );
  if (participants.length === 0) {
    throw new Error("payload.participants must contain at least one participant");
  }

  const participantIds = new Set<string>();
  for (const participant of participants) {
    if (participantIds.has(participant.id)) {
      throw new Error(`payload.participants contains duplicate id '${participant.id}'`);
    }
    participantIds.add(participant.id);
  }

  const relations = base.payload.relations.map((entry, index) =>
    parseRelation(entry, index),
  );

  for (const relation of relations) {
    if (!participantIds.has(relation.between[0])) {
      throw new Error(`relation '${relation.id}' references unknown participant '${relation.between[0]}'`);
    }
    if (!participantIds.has(relation.between[1])) {
      throw new Error(`relation '${relation.id}' references unknown participant '${relation.between[1]}'`);
    }
  }

  if (participants.length > 1 && relations.length === 0) {
    throw new Error("payload.relations must contain at least one relation when multiple participants exist");
  }

  return {
    ...base,
    payload: {
      ...(actRules ? { actRules } : {}),
      participants,
      relations,
    },
  };
}

export function safeParseActAsset(input: unknown): ParseResult<ActAssetV1> {
  return safeParse(() => parseActAsset(input));
}
