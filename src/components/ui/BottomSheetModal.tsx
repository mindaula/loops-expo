import type { ReactNode } from 'react';
import { Modal, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from 'twrnc';

interface BottomSheetModalProps {
    visible: boolean;
    onClose: () => void;
    children?: ReactNode;
    /** Applied to the sheet container, e.g. `{ maxHeight: '85%' }`. */
    containerStyle?: StyleProp<ViewStyle>;
    /**
     * When true (default) the sheet renders its own chrome: rounded surface,
     * grabber and safe-area padding. Pass false when the caller already
     * provides that container itself.
     */
    cancelSpacing?: boolean;
}

/**
 * Slide-up sheet anchored to the bottom of the screen, dismissed by tapping
 * the backdrop or the hardware back button.
 */
export function BottomSheetModal({
    visible,
    onClose,
    children,
    containerStyle,
    cancelSpacing = true,
}: BottomSheetModalProps) {
    const insets = useSafeAreaInsets();

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={tw`flex-1 justify-end`}>
                <Pressable
                    style={tw`absolute inset-0 bg-black/40`}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                />

                {cancelSpacing ? (
                    <View
                        style={[
                            tw`bg-white dark:bg-black rounded-t-[20px] pt-3`,
                            { paddingBottom: insets.bottom + 20 },
                            containerStyle,
                        ]}>
                        <View
                            style={tw`w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-sm self-center mb-5`}
                        />
                        {children}
                    </View>
                ) : (
                    <View style={containerStyle}>{children}</View>
                )}
            </View>
        </Modal>
    );
}

export default BottomSheetModal;
