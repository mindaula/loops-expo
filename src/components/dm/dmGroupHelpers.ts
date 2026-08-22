import type { DmConversation, DmParticipant } from '@/types/dm';
import { dmDisplayName } from '@/components/dm/dmHelpers';

/**
 * Helpers for group conversations.
 *
 * The API (DmConversationResource) exposes `type: 'group' | 'dm'`, an optional
 * `title`, and `participants` — which lists the OTHER members only, never the
 * signed-in account.
 */

type MaybeConversation = (DmConversation & {
    type?: string;
    title?: string | null;
    participants?: DmParticipant[] | null;
}) | null | undefined;

export function isGroupConversation(conversation: MaybeConversation): boolean {
    return conversation?.type === 'group';
}

/** The other members of the conversation; never includes the signed-in user. */
export function conversationParticipants(conversation: MaybeConversation): DmParticipant[] {
    if (!conversation) return [];

    if (Array.isArray(conversation.participants) && conversation.participants.length > 0) {
        return conversation.participants.filter(Boolean);
    }

    // One-to-one conversations only carry the single `participant`.
    return conversation.participant ? [conversation.participant] : [];
}

/**
 * Total member count including the signed-in user, matching the "{n} members"
 * label in the conversation header.
 */
export function conversationMemberCount(conversation: MaybeConversation): number {
    if (!conversation) return 0;

    return conversationParticipants(conversation).length + 1;
}

/**
 * Group title when the group has one, otherwise a list of the other members'
 * names so the header is never empty.
 */
export function conversationDisplayName(conversation: MaybeConversation): string {
    if (!conversation) return 'Message';

    const title = conversation.title?.trim();
    if (title) return title;

    const names = conversationParticipants(conversation).map((p) => dmDisplayName(p));

    if (names.length === 0) return 'Group';
    if (names.length <= 3) return names.join(', ');

    return `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}
