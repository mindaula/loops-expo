import Avatar from '@/components/Avatar';
import { dmDisplayName, dmHandle } from '@/components/dm/dmHelpers';
import {
    conversationDisplayName,
    conversationMemberCount,
    conversationParticipants,
} from '@/components/dm/dmGroupHelpers';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { StackText } from '@/components/ui/Stack';
import type { DmConversation } from '@/types/dm';
import { dmLeaveGroup } from '@/utils/requests';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TouchableOpacity, View } from 'react-native';
import tw from 'twrnc';

interface GroupInfoSheetProps {
    visible: boolean;
    conversation: DmConversation | null | undefined;
    onClose: () => void;
    onLeft: () => void;
    onOpenProfile: (profileId: string) => void;
}

/**
 * Sheet listing the members of a group conversation, with the option to leave.
 */
export function GroupInfoSheet({
    visible,
    conversation,
    onClose,
    onLeft,
    onOpenProfile,
}: GroupInfoSheetProps) {
    const [leaving, setLeaving] = useState(false);

    const members = conversationParticipants(conversation);
    const title = conversationDisplayName(conversation);
    const memberCount = conversationMemberCount(conversation);

    const confirmLeave = () => {
        Alert.alert('Leave group', 'You will stop receiving messages from this group.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Leave',
                style: 'destructive',
                onPress: async () => {
                    if (!conversation?.id) return;

                    setLeaving(true);
                    try {
                        await dmLeaveGroup(String(conversation.id));
                        onLeft();
                    } catch {
                        Alert.alert('Error', 'Could not leave the group. Please try again.');
                    } finally {
                        setLeaving(false);
                    }
                },
            },
        ]);
    };

    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            containerStyle={{ maxHeight: '85%' }}>
            <View style={tw`px-5 pb-2`}>
                <StackText fontSize="$5" fontWeight="bold" textColor="text-black dark:text-white">
                    {title}
                </StackText>
                <StackText fontSize="$3" textColor="text-gray-500 dark:text-gray-400">
                    {memberCount} members
                </StackText>
            </View>

            <ScrollView style={tw`mt-2`}>
                {members.map((member) => (
                    <TouchableOpacity
                        key={String(member.id)}
                        style={tw`flex-row items-center px-5 py-3`}
                        onPress={() => onOpenProfile(String(member.id))}>
                        <Avatar url={member.avatar} width={40} />
                        <View style={tw`ml-3 flex-1`}>
                            <StackText
                                fontSize="$4"
                                fontWeight="semibold"
                                textColor="text-black dark:text-white">
                                {dmDisplayName(member)}
                            </StackText>
                            {!!dmHandle(member) && (
                                <StackText
                                    fontSize="$3"
                                    textColor="text-gray-500 dark:text-gray-400">
                                    {dmHandle(member)}
                                </StackText>
                            )}
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <TouchableOpacity
                style={tw`flex-row items-center px-5 py-4 mt-1`}
                disabled={leaving}
                onPress={confirmLeave}>
                {leaving ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                    <Ionicons name="exit-outline" size={22} color="#EF4444" />
                )}
                <StackText
                    fontSize="$4"
                    fontWeight="semibold"
                    textColor="text-red-500"
                    style={tw`ml-3`}>
                    Leave group
                </StackText>
            </TouchableOpacity>
        </BottomSheetModal>
    );
}

export default GroupInfoSheet;
