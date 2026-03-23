import {
  assertBaseAssetShape,
  safeParse,
  isRecord,
  isNonEmptyString,
  parseDotAssetUrn,
} from "./asset-base.js";
import type { DotAssetBase, ParseResult } from "./asset-base.js";

export type ActParticipantSubscriptionsV1 = {
  messagesFrom?: string[];
  messageTags?: string[];
  callboardKeys?: string[];
  eventTypes?: Array<"runtime.idle">;
};

export type ActParticipantV1 = {
  key: string;
  performer: string;
  subscriptions?: ActParticipantSubscriptionsV1;
};

export type ActRelationV1 = {
  between: [string, string];
  direction: "both" | "one-way";
  name: string;
  description: string;
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

  const messagesFrom = parseOptionalStringArray(input.messagesFrom, `${fieldName}.messagesFrom`);
  const messageTags = parseOptionalStringArray(input.messageTags, `${fieldName}.messageTags`);
  const callboardKeys = parseOptionalStringArray(input.callboardKeys, `${fieldName}.callboardKeys`);
  const eventTypes = parseOptionalStringArray(input.eventTypes, `${fieldName}.eventTypes`);

  if (eventTypes && eventTypes.some((entry) => entry !== "runtime.idle")) {
    throw new Error(`${fieldName}.eventTypes only supports 'runtime.idle' in act.v1`);
  }

  return {
    ...(messagesFrom ? { messagesFrom } : {}),
    ...(messageTags ? { messageTags } : {}),
    ...(callboardKeys ? { callboardKeys } : {}),
    ...(eventTypes ? { eventTypes: eventTypes as Array<"runtime.idle"> } : {}),
  };
}

function parseParticipant(input: unknown, index: number): ActParticipantV1 {
  if (!isRecord(input)) {
    throw new Error(`payload.participants[${index}] must be an object`);
  }
  if ("id" in input) {
    throw new Error(`payload.participants[${index}].id is not supported; use key`);
  }
  if ("activeDances" in input) {
    throw new Error(`payload.participants[${index}].activeDances is not supported in act.v1`);
  }
  if (!isNonEmptyString(input.key)) {
    throw new Error(`payload.participants[${index}].key must be a non-empty string`);
  }
  if (!isNonEmptyString(input.performer)) {
    throw new Error(`payload.participants[${index}].performer must be a non-empty string`);
  }

  parseDotAssetUrn(input.performer, "performer");

  return {
    key: input.key,
    performer: input.performer,
    ...(input.subscriptions !== undefined
      ? { subscriptions: parseSubscriptions(input.subscriptions, `payload.participants[${index}].subscriptions`) }
      : {}),
  };
}

function parseRelation(input: unknown, index: number): ActRelationV1 {
  if (!isRecord(input)) {
    throw new Error(`payload.relations[${index}] must be an object`);
  }
  if ("id" in input) {
    throw new Error(`payload.relations[${index}].id is not supported in act.v1`);
  }
  if ("permissions" in input) {
    throw new Error(`payload.relations[${index}].permissions is not supported in act.v1`);
  }
  if ("maxCalls" in input) {
    throw new Error(`payload.relations[${index}].maxCalls is not supported in act.v1`);
  }
  if ("timeout" in input) {
    throw new Error(`payload.relations[${index}].timeout is not supported in act.v1`);
  }
  if ("sessionPolicy" in input) {
    throw new Error(`payload.relations[${index}].sessionPolicy is not supported in act.v1`);
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

  if (input.direction !== "both" && input.direction !== "one-way") {
    throw new Error(`payload.relations[${index}].direction must be 'both' or 'one-way'`);
  }

  if (!isNonEmptyString(input.name)) {
    throw new Error(`payload.relations[${index}].name must be a non-empty string`);
  }

  if (!isNonEmptyString(input.description)) {
    throw new Error(`payload.relations[${index}].description must be a non-empty string`);
  }

  return {
    between,
    direction: input.direction,
    name: input.name,
    description: input.description,
  };
}

export function parseActAsset(input: unknown): ActAssetV1 {
  const base = assertBaseAssetShape(input, "act");

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

  const participantKeys = new Set<string>();
  for (const participant of participants) {
    if (participantKeys.has(participant.key)) {
      throw new Error(`payload.participants contains duplicate key '${participant.key}'`);
    }
    participantKeys.add(participant.key);
  }

  const relations = base.payload.relations.map((entry, index) =>
    parseRelation(entry, index),
  );

  for (const relation of relations) {
    if (!participantKeys.has(relation.between[0])) {
      throw new Error(`relation references unknown participant '${relation.between[0]}'`);
    }
    if (!participantKeys.has(relation.between[1])) {
      throw new Error(`relation references unknown participant '${relation.between[1]}'`);
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
