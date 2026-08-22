import { useTheme } from '@/contexts/ThemeContext';
import { mediaSource } from '@/utils/mediaSource';
import { shareContent } from '@/utils/sharer';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    Pressable,
    Share,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 60;

type ReportPayload = {
    id: string;
    key: string;
    type: string;
    comment: string;
};

type CommentPayload = {
    id: string;
    commentText: string;
    parentId?: string;
};

type CommentDeletePayload = {
    videoId: string;
    commentId: string;
};

type CommentReplyDeletePayload = {
    videoId: string;
    parentId: string;
    commentId: string;
};

type CommentLikePayload = {
    likeState: string;
    videoId: string;
    commentId: string;
};

type CommentReplyLikePayload = {
    likeState: string;
    videoId: string;
    commentId: string;
    parentId: string;
};

export default function ShareModal({ visible, item, onClose }) {
    const insets = useSafeAreaInsets();
    const { colorScheme } = useTheme();
    const [downloading, setDownloading] = useState(false);

    if (!item) return null;

    const handleRepost = async () => {
        console.log('Repost video:', item.id);
        onClose();
    };

    const handleNativeShare = async () => {
        try {
            const result = await shareContent({
                message: `Check out this video on Loops!`,
                url: item?.url,
            });

            if (result.action === Share.sharedAction) {
                onClose();
            }
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const handleCopyLink = async () => {
        try {
            if (!item?.url) return;

            await Clipboard.setStringAsync(item.url);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
        } catch (error) {
            console.error('Copy link error:', error);
        }
    };

    /**
     * Saves the video to the device gallery.
     *
     * The file lives behind the authenticated media route, so the download has
     * to carry the same Authorization header the player uses -- a plain URL
     * fetch would come back with a 401 instead of a video.
     */
    const handleDownload = async () => {
        if (downloading) return;

        const source = mediaSource(item?.media?.src_url);

        if (!source?.uri) {
            Alert.alert('Download failed', 'This video has no downloadable file.');
            return;
        }

        setDownloading(true);

        let target: File | null = null;

        try {
            const permission = await MediaLibrary.requestPermissionsAsync();

            if (!permission.granted) {
                Alert.alert(
                    'Permission needed',
                    `Loops needs access to your photo library to save this video.`,
                );
                return;
            }

            target = new File(Paths.cache, `Loops-${item.id}.mp4`);

            if (target.exists) {
                target.delete();
            }

            const downloaded = await File.downloadFileAsync(source.uri, target, {
                headers: source.headers,
            });

            await MediaLibrary.saveToLibraryAsync(downloaded.uri);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Saved', 'The video was saved to your gallery.');
            onClose();
        } catch (error) {
            console.error('Download error:', error);
            Alert.alert('Download failed', 'The video could not be saved. Please try again.');
        } finally {
            // The gallery keeps its own copy; the staging file is just overhead.
            try {
                if (target?.exists) target.delete();
            } catch {
                // Nothing to do -- the cache directory is cleaned by the system.
            }

            setDownloading(false);
        }
    };

    const shareOptions = [
        // {
        //   icon: 'repeat',
        //   label: 'Repost',
        //   onPress: handleRepost,
        // },
        {
            icon: 'link-outline',
            label: 'Copy Link',
            onPress: handleCopyLink,
        },
        ...(item?.permissions?.can_download
            ? [
                  {
                      icon: downloading ? 'hourglass-outline' : 'download-outline',
                      label: downloading ? 'Saving…' : 'Download',
                      onPress: handleDownload,
                      busy: downloading,
                  },
              ]
            : []),
        {
            icon: 'share-outline',
            label: 'Other',
            onPress: handleNativeShare,
        },
    ];

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={tw`flex-1 justify-end`}>
                <Pressable style={tw`absolute inset-0`} onPress={onClose} />
                <View
                    style={[
                        tw`bg-white dark:bg-gray-900 rounded-t-[20px] pt-3`,
                        { paddingBottom: insets.bottom + 20 },
                    ]}>
                    <View
                        style={tw`w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-sm self-center mb-5`}
                    />
                    <Text
                        style={tw`text-lg font-bold text-center mb-6 px-4 text-black dark:text-white`}>
                        Share to
                    </Text>

                    <View style={tw`flex-row justify-around px-4 mb-5`}>
                        {shareOptions.map((option) => (
                            <TouchableOpacity
                                key={option.label}
                                style={tw`items-center w-20`}
                                disabled={option.busy}
                                accessibilityRole="button"
                                accessibilityLabel={option.label}
                                accessibilityState={{ disabled: !!option.busy }}
                                onPress={option.onPress}>
                                <View
                                    style={tw`w-15 h-15 rounded-full bg-gray-100 dark:bg-gray-800 justify-center items-center mb-2`}>
                                    {option.busy ? (
                                        <ActivityIndicator
                                            color={colorScheme === 'dark' ? '#fff' : '#000'}
                                        />
                                    ) : (
                                        <Ionicons
                                            name={option.icon}
                                            size={28}
                                            color={colorScheme === 'dark' ? '#fff' : '#000'}
                                        />
                                    )}
                                </View>
                                <Text style={tw`text-xs text-black dark:text-white text-center`}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={tw`mt-3 py-4 items-center border-t border-gray-100 dark:border-gray-800`}
                        onPress={onClose}>
                        <Text style={tw`text-base font-semibold text-[#007AFF]`}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
