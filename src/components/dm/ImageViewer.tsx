import type { DmMediaEntity } from '@/types/dm';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Modal, Pressable, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';

interface ImageViewerProps {
    visible: boolean;
    media: DmMediaEntity | null;
    onClose: () => void;
}

/**
 * Full screen viewer for an image attached to a direct message.
 */
export function ImageViewer({ visible, media, onClose }: ImageViewerProps) {
    const insets = useSafeAreaInsets();

    if (!media) return null;

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <StatusBar barStyle="light-content" />

            <View style={tw`flex-1 bg-black`}>
                <Pressable style={tw`flex-1 items-center justify-center`} onPress={onClose}>
                    <ExpoImage
                        source={{ uri: media.url }}
                        placeholder={media.blurhash ? { blurhash: media.blurhash } : undefined}
                        style={tw`w-full h-full`}
                        contentFit="contain"
                        transition={150}
                        accessibilityLabel={media.description || 'Image'}
                    />
                </Pressable>

                <Pressable
                    onPress={onClose}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Close image"
                    style={[
                        tw`absolute right-4 w-10 h-10 rounded-full bg-black/60 items-center justify-center`,
                        { top: insets.top + 8 },
                    ]}>
                    <Ionicons name="close" size={24} color="#fff" />
                </Pressable>
            </View>
        </Modal>
    );
}

export default ImageViewer;
