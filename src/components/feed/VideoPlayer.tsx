import Avatar from '@/components/Avatar';
import LinkifiedCaption from '@/components/feed/LinkifiedCaption';
import { PressableHaptics } from '@/components/ui/PressableHaptics';
import { mediaSource } from '@/utils/mediaSource';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

/** Seconds as m:ss, for the labels either side of the seek bar. */
function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '0:00';
    }

    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;

    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({
    item,
    isActive,
    onLike,
    onComment,
    onShare,
    onBookmark,
    onOther,
    bottomInset,
    commentsOpen,
    screenFocused,
    videoPlaybackRates,
    shareOpen,
    otherOpen,
    navigation,
    onNavigate,
    tabBarHeight = 60,
    itemHeight,
}) {
    const [isLiked, setIsLiked] = useState(item.has_liked);
    const [isBookmarked, setIsBookmarked] = useState(item.has_bookmarked);
    const [showControls, setShowControls] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const manualControlRef = useRef(false);
    const isMountedRef = useRef(true);
    const wasActiveRef = useRef(false);
    const router = useRouter();
    const [playSensitive, setPlaySensitive] = useState(false);
    const controlsTimeoutRef = useRef(null);

    const playbackRate = videoPlaybackRates[item.id] || 1.0;

    const player = useVideoPlayer(mediaSource(item.media.src_url), (player) => {
        player.loop = true;
        player.playbackRate = playbackRate;

        // Without limits the player pulls the whole file as fast as the link
        // allows, for every mounted item at once. Measured on a live feed that
        // was up to eight complete downloads in parallel -- 44 MB a minute for
        // a library of 112 MB. A short read-ahead is all a clip this length
        // needs, and it leaves the connection to the video actually on screen.
        player.bufferOptions = {
            preferredForwardBufferDuration: 6,
            maxBufferBytes: 4 * 1024 * 1024,
            minBufferForPlayback: 1,
            prioritizeTimeOverSizeThreshold: true,
        };
    });

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!player) return;
        try {
            player.playbackRate = playbackRate;
        } catch (error) {
            console.log('Playback rate error:', error);
        }
    }, [playbackRate, player]);

    useEffect(() => {
        if (!player) return;

        try {
            if (manualControlRef.current) {
                return;
            }

            const shouldPlay = isActive && screenFocused && !(item.is_sensitive && !playSensitive);

            if (isActive && !wasActiveRef.current) {
                player.currentTime = 0;
            }

            if (shouldPlay && isMountedRef.current) {
                player.play();
                setIsPlaying(true);
            } else if (isMountedRef.current) {
                player.pause();
                setIsPlaying(false);
            }

            wasActiveRef.current = isActive;
        } catch (error) {
            console.log('Player control error:', error);
        }
    }, [
        isActive,
        commentsOpen,
        shareOpen,
        otherOpen,
        screenFocused,
        player,
        item.is_sensitive,
        playSensitive,
    ]);

    useEffect(() => {
        if (!isActive) {
            manualControlRef.current = false;
            setPlaySensitive(false);
        }
    }, [isActive]);

    const handleLike = () => {
        setIsLiked(!isLiked);
        onLike(item.id, !isLiked);
    };

    const handleBookmark = () => {
        setIsBookmarked(!isBookmarked);
        onBookmark(item.id, !isBookmarked);
    };

    // Playback progress for the scrub bar. `timeUpdate` fires on the interval
    // set above; while the user drags we ignore it so the thumb does not fight
    // the finger.
    // No initial value: until the first event arrives we fall back to the
    // player's own position, otherwise the bar would open at zero.
    const progress = useEvent(player, 'timeUpdate', null) as {
        currentTime?: number;
    } | null;
    // Progress events are off unless the scrub bar is actually on screen.
    // They default to off in expo-video for good reason: every tick re-renders
    // this component, and with several players mounted at once that was enough
    // extra work to make busy videos stutter.
    useEffect(() => {
        if (!player) return;

        try {
            player.timeUpdateEventInterval = showControls ? 0.25 : 0;
        } catch (error) {
            console.log('timeUpdateEventInterval error:', error);
        }
    }, [player, showControls]);

    const [barWidth, setBarWidth] = useState(0);
    const [scrubTime, setScrubTime] = useState<number | null>(null);

    const duration = player?.duration ?? 0;
    const currentTime = scrubTime ?? progress?.currentTime ?? player?.currentTime ?? 0;
    const fraction = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

    const seekToFraction = useCallback(
        (f: number) => {
            if (!player || !isMountedRef.current) return;

            const total = player.duration ?? 0;
            if (total <= 0) return;

            const target = Math.min(total, Math.max(0, f * total));

            // Seek on every move, not only on release: paused seeking is cheap
            // and the frame under the finger is the whole point of a scrub bar.
            setScrubTime(target);

            try {
                player.currentTime = target;
            } catch (error) {
                console.log('Seek error:', error);
            }
        },
        [player],
    );

    // runOnJS keeps these callbacks on the JS thread: they touch the player
    // object and React state, neither of which is safe from a worklet.
    const scrubGesture = React.useMemo(() => {
        // activeOffsetX claims the gesture as soon as the finger moves
        // sideways, and failOffsetY hands it back for vertical swipes.
        // Without this the surrounding vertical list wins the gesture and
        // the drag never reaches these handlers at all.
        const pan = Gesture.Pan()
            .runOnJS(true)
            .minDistance(0)
            .activeOffsetX([-4, 4])
            .failOffsetY([-24, 24])
            .onBegin((e) => {
                if (barWidth > 0) seekToFraction(e.x / barWidth);
            })
            .onUpdate((e) => {
                if (barWidth > 0) seekToFraction(e.x / barWidth);
            });

        // Tapping anywhere on the bar jumps there, which is both expected
        // and a fallback if the pan is ever lost to another recogniser.
        const tap = Gesture.Tap()
            .runOnJS(true)
            .onEnd((e) => {
                if (barWidth > 0) seekToFraction(e.x / barWidth);
            });

        return Gesture.Race(pan, tap);
    }, [barWidth, seekToFraction]);

    const togglePlayPause = () => {
        if (!player || !isMountedRef.current) return;

        try {
            manualControlRef.current = true;

            if (isPlaying) {
                player.pause();
                setIsPlaying(false);
            } else {
                // Release the held scrub position; progress events take over.
                setScrubTime(null);
                player.play();
                setIsPlaying(true);
            }
        } catch (error) {
            console.log('Toggle play/pause error:', error);
        }
    };

    // One tap pauses and reveals the controls; the next resumes and hides them.
    // Previously a tap only revealed the overlay, so pausing took a second tap
    // on the button and the overlay was gone again after three seconds.
    const handleScreenPress = () => {
        if (!isMountedRef.current) {
            return;
        }

        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = null;
        }

        const wasPlaying = isPlaying;

        togglePlayPause();
        setShowControls(wasPlaying);

        // Only fade the controls out again while the video is running. Paused
        // means the user is scrubbing, and the bar must stay under the finger.
        if (!wasPlaying) {
            manualControlRef.current = false;
        }
    };

    // A tap gesture rather than a Pressable: the overlay sits on top of a
    // native video surface, which swallowed the touch before it ever reached
    // React Native's own handler.
    const tapGesture = React.useMemo(
        () =>
            Gesture.Tap()
                .runOnJS(true)
                .onEnd(() => handleScreenPress()),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [isPlaying, showControls],
    );

    useEffect(() => {
        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, []);

    const handleViewSensitiveContent = () => {
        setPlaySensitive(true);
    };

    const likeCount = item.likes + (isLiked && !item.has_liked ? 1 : 0);
    const bookmarkCount = item.bookmarks + (isBookmarked && !item.has_bookmarked ? 1 : 0);

    if (item.is_sensitive && !playSensitive) {
        return (
            <View style={[styles.videoContainer, { height: itemHeight || SCREEN_HEIGHT }]}>
                <View
                    style={styles.sensitiveOverlay}
                    accessible={true}
                    accessibilityLabel="Sensitive content warning. This video may contain sensitive content."
                    accessibilityRole="alert">
                    <View style={styles.sensitiveContent}>
                        <View style={styles.sensitiveIconWrapper}>
                            <Ionicons name="eye-off-outline" size={48} color="white" />
                        </View>
                        <Text style={styles.sensitiveTitle}>Sensitive Content</Text>
                        <Text style={styles.sensitiveDescription}>
                            This video may contain sensitive content
                        </Text>
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.viewButton}
                                onPress={handleViewSensitiveContent}
                                activeOpacity={0.8}
                                accessible={true}
                                accessibilityLabel="Watch video anyway"
                                accessibilityRole="button"
                                accessibilityHint="Dismisses the sensitive content warning and plays the video">
                                <Text style={styles.viewButtonText}>Watch anyways</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.videoContainer, { height: itemHeight || SCREEN_HEIGHT }]}>
            <View style={styles.videoWrapper}>
                <VideoView
                    style={styles.video}
                    player={player}
                    allowsPictureInPicture={false}
                    nativeControls={false}
                    accessible={true}
                    accessibilityLabel={item.media.alt_text || 'Video content'}
                    accessibilityHint="Tap to show playback controls"
                    contentFit="contain"
                />

                <GestureDetector gesture={tapGesture}>
                    <View
                        style={StyleSheet.absoluteFill}
                        accessible={true}
                        accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
                        accessibilityHint="Tap to pause and show the seek bar"
                        accessibilityRole="button"
                    />
                </GestureDetector>

                {showControls && (
                    <View style={styles.controlsOverlay} pointerEvents="box-none">
                        <TouchableOpacity
                            onPress={togglePlayPause}
                            style={styles.playButton}
                            activeOpacity={0.7}
                            accessible={true}
                            accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isPlaying }}>
                            <Ionicons name={isPlaying ? 'pause' : 'play'} size={60} color="white" />
                        </TouchableOpacity>

                        <View
                            style={[
                                styles.seekBarArea,
                                { bottom: bottomInset + tabBarHeight + 64 },
                            ]}>
                            <Text style={styles.seekTime}>{formatTime(currentTime)}</Text>

                            <GestureDetector gesture={scrubGesture}>
                                <View
                                    style={styles.seekTouchArea}
                                    onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
                                    accessible={true}
                                    accessibilityLabel="Seek bar"
                                    accessibilityHint="Drag to change the playback position"
                                    accessibilityRole="adjustable">
                                    <View style={styles.seekTrack}>
                                        <View
                                            style={[
                                                styles.seekFill,
                                                { width: `${fraction * 100}%` },
                                            ]}
                                        />
                                        <View
                                            style={[
                                                styles.seekThumb,
                                                { left: `${fraction * 100}%` },
                                            ]}
                                        />
                                    </View>
                                </View>
                            </GestureDetector>

                            <Text style={styles.seekTime}>{formatTime(duration)}</Text>
                        </View>
                    </View>
                )}
            </View>

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
                style={styles.gradientOverlay}
                pointerEvents="none"
            />

            <View style={[styles.rightActions, { bottom: bottomInset + tabBarHeight + 20 }]}>
                <PressableHaptics
                    style={styles.actionButton}
                    onPress={() => router.push(`/private/profile/${item.account.id}`)}
                    accessible={true}
                    accessibilityLabel={`View ${item.account.username}'s profile`}
                    accessibilityRole="button">
                    <View style={styles.avatarContainer}>
                        <Avatar url={item.account?.avatar} />
                    </View>
                </PressableHaptics>

                <PressableHaptics
                    style={styles.actionButton}
                    onPress={handleLike}
                    accessible={true}
                    accessibilityLabel={
                        isLiked ? `Unlike. ${likeCount} likes` : `Like. ${likeCount} likes`
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: isLiked }}>
                    <Ionicons name={'heart'} size={35} color={isLiked ? '#F02C56' : 'white'} />
                    <Text style={styles.actionText} accessibilityElementsHidden={true}>
                        {likeCount}
                    </Text>
                </PressableHaptics>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onComment(item)}
                    accessible={true}
                    accessibilityLabel={
                        item.permissions?.can_comment
                            ? `Comments. ${item.comments} comments`
                            : 'Comments are disabled'
                    }
                    accessibilityRole="button">
                    <Ionicons name="chatbubble" size={32} color="white" />
                    {item.permissions?.can_comment && (
                        <Text style={styles.actionText} accessibilityElementsHidden={true}>
                            {item.comments}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleBookmark}
                    accessible={true}
                    accessibilityLabel={
                        isBookmarked
                            ? `Remove bookmark. ${bookmarkCount} bookmarks`
                            : `Bookmark. ${bookmarkCount} bookmarks`
                    }
                    accessibilityRole="button"
                    accessibilityState={{ selected: isBookmarked }}>
                    <Ionicons
                        name="bookmark"
                        size={32}
                        color={isBookmarked ? '#F02C56' : 'white'}
                    />
                    <Text style={styles.actionText} accessibilityElementsHidden={true}>
                        {bookmarkCount}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onShare(item)}
                    accessible={true}
                    accessibilityLabel={`Share. ${item.shares} shares`}
                    accessibilityRole="button">
                    <Ionicons name="arrow-redo" size={32} color="white" />
                    <Text style={styles.actionText} accessibilityElementsHidden={true}>
                        {item.shares}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onOther(item)}
                    accessible={true}
                    accessibilityLabel="More options"
                    accessibilityRole="button">
                    <MaterialCommunityIcons name="dots-horizontal" size={32} color="white" />
                </TouchableOpacity>
            </View>

            <View style={[styles.bottomInfo, { bottom: bottomInset + tabBarHeight + 10 }]}>
                <TouchableOpacity
                    onPress={() => {
                        onNavigate?.();
                        router.push(`/private/profile/${item.account.id}`);
                    }}
                    accessible={true}
                    accessibilityLabel={`View @${item.account.username}'s profile`}
                    accessibilityRole="link">
                    <Text style={styles.username}>@{item.account.username}</Text>
                </TouchableOpacity>
                {item.caption && (
                    <LinkifiedCaption
                        caption={item.caption}
                        tags={item.tags || []}
                        mentions={item.mentions || []}
                        style={styles.caption}
                        numberOfLines={1}
                        onHashtagPress={(tag) => {
                            onNavigate?.();
                            router.push(`/private/search?query=${tag}`);
                        }}
                        onMentionPress={(username, profileId) => {
                            onNavigate?.();
                            router.push(`/private/profile/${profileId}`);
                        }}
                        onMorePress={() => onComment(item)}
                    />
                )}

                {item?.meta?.contains_ai && (
                    <View>
                        <View
                            style={styles.aiLabelWrapper}
                            accessible={true}
                            accessibilityLabel="Creator labeled this as AI-generated content"
                            accessibilityRole="text">
                            <Text style={styles.aiLabelText}>Creator labeled as AI-generated</Text>
                        </View>
                    </View>
                )}

                <View
                    style={styles.audioInfo}
                    accessible={true}
                    accessibilityLabel="Original Audio"
                    accessibilityRole="text">
                    <Ionicons
                        name="musical-notes"
                        size={14}
                        color="white"
                        importantForAccessibility="no"
                    />
                    <Text style={styles.audioText}>Original Audio</Text>
                </View>

                {item?.meta?.contains_ad && (
                    <View>
                        <View
                            style={styles.aiLabelWrapper}
                            accessible={true}
                            accessibilityLabel="Sponsored content"
                            accessibilityRole="text">
                            <Text style={styles.aiLabelText}>Sponsored</Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    videoContainer: {
        width: SCREEN_WIDTH,
        position: 'relative',
    },
    videoWrapper: {
        flex: 1,
        backgroundColor: '#000',
    },
    video: {
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    },
    seekBarArea: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    seekTime: {
        color: '#fff',
        fontSize: 12,
        fontVariant: ['tabular-nums'],
        minWidth: 38,
        textAlign: 'center',
    },
    // Generous vertical padding: the visible track is thin, but the area that
    // accepts the drag must be comfortable to hit.
    seekTouchArea: {
        flex: 1,
        paddingVertical: 14,
        justifyContent: 'center',
    },
    seekTrack: {
        height: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.35)',
    },
    seekFill: {
        height: 3,
        borderRadius: 2,
        backgroundColor: '#fff',
    },
    seekThumb: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#fff',
        marginLeft: -6,
        top: -4.5,
    },
    controlsOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        zIndex: 10,
        elevation: 10,
    },
    playButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 11,
        elevation: 11,
    },
    sensitiveOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.99)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 15,
        elevation: 15,
    },
    sensitiveContent: {
        alignItems: 'center',
        paddingHorizontal: 40,
        width: '100%',
    },
    sensitiveIconWrapper: {
        padding: 20,
        borderRadius: 90,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    sensitiveTitle: {
        color: 'white',
        fontSize: 24,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 8,
    },
    sensitiveDescription: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
    },
    buttonContainer: {
        width: '100%',
    },
    viewButton: {
        backgroundColor: 'white',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
    },
    viewButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    },
    rightActions: {
        position: 'absolute',
        right: 12,
        gap: 20,
        zIndex: 5,
        elevation: 5,
    },
    actionButton: {
        alignItems: 'center',
        ...Platform.select({
            ios: {
                borderRadius: 50,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 3,
            },
            android: {
                filter: [
                    {
                        dropShadow: {
                            offsetX: 0,
                            offsetY: 2,
                            standardDeviation: '3px',
                            color: '#0000004D',
                        },
                    },
                ],
            },
        }),
    },
    avatarContainer: {
        borderWidth: 2,
        borderColor: 'white',
        borderRadius: 24,
        overflow: 'hidden',
    },
    actionText: {
        color: 'white',
        fontWeight: '600',
        marginTop: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    bottomInfo: {
        position: 'absolute',
        left: 12,
        right: 80,
    },
    username: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    caption: {
        color: 'white',
        fontSize: 16,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    audioInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        opacity: 0.6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    audioText: {
        color: 'white',
        fontSize: 14,
    },
    gradientOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '20%',
    },
    aiLabelWrapper: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        marginVertical: 6,
        alignSelf: 'flex-start',
    },
    aiLabelText: {
        color: '#ffffff',
        fontWeight: 500,
    },
});
