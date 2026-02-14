/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Direction, useTheme } from '@mui/material/styles';

import { ChapterIdInfo, TChapterReader } from '@/features/chapter/Chapter.types.ts';
import { Chapters } from '@/features/chapter/services/Chapters.ts';
import {
    IReaderSettings,
    ReaderExitMode,
    ReaderOpenChapterLocationState,
    ReaderOverlayMode,
    ReadingDirection,
    ReadingMode,
} from '@/features/reader/Reader.types.ts';

import { requestManager } from '@/lib/requests/RequestManager.ts';
import { AppStorage } from '@/lib/storage/AppStorage.ts';
import { getMetadataKey } from '@/features/metadata/Metadata.utils.ts';
import { useMetadataServerSettings } from '@/features/settings/services/ServerSettingsMetadata.ts';

import { useBackButton } from '@/base/hooks/useBackButton.ts';
import { GLOBAL_READER_SETTING_KEYS } from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { UpdateChapterPatchInput } from '@/lib/graphql/generated/graphql.ts';
import {
    getChapterIdsForDownloadAhead,
    getChapterIdsToDeleteForChapterUpdate,
    getReaderChapterFromCache,
    isInDownloadAheadRange,
    updateReaderStateVisibleChapters,
} from '@/features/reader/Reader.utils.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { MediaQuery } from '@/base/utils/MediaQuery.tsx';
import { Queue } from '@/lib/Queue.ts';
import { AppRoutes } from '@/base/AppRoute.constants.ts';

import { FALLBACK_MANGA, GLOBAL_READER_SETTINGS_MANGA } from '@/features/manga/Manga.constants.ts';

import { DirectionOffset } from '@/base/Base.types.ts';
import {
    getReaderChaptersStore,
    getReaderSettingsStore,
    getReaderStore,
    useReaderSettingsStore,
} from '@/features/reader/stores/ReaderStore.ts';
import { ReactRouter } from '@/lib/react-router/ReactRouter.ts';
import { ReaderChaptersStoreSlice } from '@/features/reader/stores/ReaderChaptersStore.ts';

const DIRECTION_TO_INVERTED: Record<Direction, Direction> = {
    ltr: 'rtl',
    rtl: 'ltr',
};

const DIRECTION_TO_READING_DIRECTION: Record<Direction, ReadingDirection> = {
    ltr: ReadingDirection.LTR,
    rtl: ReadingDirection.RTL,
};

export class ReaderService {
    private static downloadAheadQueue: Queue = new Queue(1);

    private static chapterUpdateQueues: Map<ChapterIdInfo['id'], Queue> = new Map();

    private static getOrCreateChapterUpdateQueue(id: ChapterIdInfo['id']): Queue {
        if (!ReaderService.chapterUpdateQueues.has(id)) {
            ReaderService.chapterUpdateQueues.set(id, new Queue(1));
        }

        return ReaderService.chapterUpdateQueues.get(id)!;
    }

    static navigateToChapter(chapter: TChapterReader, state?: ReaderOpenChapterLocationState): void {
        ReactRouter.navigate(Chapters.getReaderUrl(chapter), {
            replace: true,
            state,
        });
    }

    static downloadAhead(
        currentChapter: TChapterReader,
        nextChapter: TChapterReader | undefined,
        nextChapters: TChapterReader[],
        pageIndex: number,
        downloadAheadLimit: number,
    ): void {
        const key = `${currentChapter.id}_${nextChapter?.id}_${pageIndex}_${downloadAheadLimit}`;

        ReaderService.downloadAheadQueue.enqueue(key, async () => {
            const chapterIdsForDownloadAhead = getChapterIdsForDownloadAhead(
                currentChapter,
                nextChapter,
                nextChapters,
                pageIndex,
                downloadAheadLimit,
            );

            if (!chapterIdsForDownloadAhead.length) {
                return;
            }

            try {
                await Chapters.download(chapterIdsForDownloadAhead);
            } catch (e) {
                defaultPromiseErrorHandler('ReaderService::useUpdateCurrentPageIndex: download ahead')(e);
            }
        });
    }

    static preloadChapter(
        pageIndex: number,
        pageCount: number,
        chapter: TChapterReader | undefined | null,
        lastLeadingChapterSourceOrder: number,
        lastTrailingChapterSourceOrder: number,
        setReaderStateChapters: ReaderChaptersStoreSlice['chapters']['setReaderStateChapters'],
        direction: DirectionOffset,
    ): void {
        if (!chapter) {
            return;
        }

        const isPreviousChapter = direction === DirectionOffset.PREVIOUS;
        const isNextChapter = direction === DirectionOffset.NEXT;

        const isAlreadyPreloaded =
            (isPreviousChapter && lastLeadingChapterSourceOrder <= chapter.sourceOrder) ||
            (isNextChapter && lastTrailingChapterSourceOrder >= chapter.sourceOrder);
        const shouldPreload = !isAlreadyPreloaded && isInDownloadAheadRange(pageIndex, pageCount, direction);
        if (!shouldPreload) {
            return;
        }

        setReaderStateChapters((state) =>
            updateReaderStateVisibleChapters(
                isPreviousChapter,
                state,
                chapter.sourceOrder,
                false,
                isPreviousChapter ? true : undefined,
                isNextChapter ? true : undefined,
            ),
        );
    }

    static useUpdateChapter(): (patch: UpdateChapterPatchInput) => void {
        const {
            settings: { deleteChaptersWhileReading, deleteChaptersWithBookmark, updateProgressAfterReading },
        } = useMetadataServerSettings();

        return useCallback(
            (patch) => {
                const { manga } = getReaderStore();
                const { currentChapter, mangaChapters, chapters } = getReaderChaptersStore();
                const { shouldSkipDupChapters } = getReaderSettingsStore();

                if (!manga || !currentChapter || !mangaChapters) {
                    return;
                }

                const previousChapters = Chapters.getNextChapters(currentChapter, chapters, {
                    offset: DirectionOffset.PREVIOUS,
                });

                const update = async () => {
                    const chapterIdsToUpdate = Chapters.getIds(
                        shouldSkipDupChapters
                            ? Chapters.addDuplicates([currentChapter], mangaChapters)
                            : [currentChapter],
                    );

                    const chapterIdsToDelete = getChapterIdsToDeleteForChapterUpdate(
                        currentChapter,
                        mangaChapters,
                        previousChapters,
                        patch,
                        deleteChaptersWhileReading,
                        deleteChaptersWithBookmark,
                        shouldSkipDupChapters,
                    );

                    const isUpdateRequired =
                        !!chapterIdsToDelete.length ||
                        chapterIdsToUpdate.some((id) => {
                            const chapterUpToDateData = getReaderChapterFromCache(id);
                            if (!chapterUpToDateData) {
                                return false;
                            }

                            return (
                                (patch.isRead !== undefined && patch.isRead !== chapterUpToDateData.isRead) ||
                                (patch.lastPageRead !== undefined &&
                                    patch.lastPageRead !== chapterUpToDateData.lastPageRead) ||
                                (patch.isBookmarked !== undefined &&
                                    patch.isBookmarked !== chapterUpToDateData.isBookmarked)
                            );
                        });
                    if (!isUpdateRequired) {
                        return;
                    }

                    await requestManager
                        .updateChapters(
                            chapterIdsToUpdate,
                            {
                                ...patch,
                                chapterIdsToDelete,
                                trackProgressMangaId:
                                    updateProgressAfterReading && patch.isRead && manga.trackRecords.totalCount
                                        ? manga.id
                                        : undefined,
                            },
                            { errorPolicy: 'all' },
                        )
                        .response.catch(defaultPromiseErrorHandler('ReaderService::useUpdateChapter'));
                };

                ReaderService.getOrCreateChapterUpdateQueue(currentChapter.id).enqueue(`${currentChapter.id}`, update);
            },
            [deleteChaptersWhileReading, deleteChaptersWithBookmark, updateProgressAfterReading],
        );
    }

    static useGetThemeDirection(): Direction {
        const { direction } = useTheme();
        const readingDirection = useReaderSettingsStore((state) => state.settings.readingDirection.value);

        return DIRECTION_TO_READING_DIRECTION[direction] === readingDirection
            ? direction
            : DIRECTION_TO_INVERTED[direction];
    }

    /**
     * Writes the change immediately to the cache and sends a mutation in case "commit" is true.
     */
    static updateSetting<Setting extends keyof IReaderSettings>(
        setting: Setting,
        value: IReaderSettings[Setting],
        commit: boolean = true,
        isGlobal: boolean = false,
        profile?: ReadingMode,
    ): void {
        const { manga: currentManga } = getReaderStore();
        const manga = currentManga ?? (isGlobal ? GLOBAL_READER_SETTINGS_MANGA : currentManga);

        if (!manga || manga.id === FALLBACK_MANGA.id) {
            return;
        }

        const isGlobalSetting = isGlobal || GLOBAL_READER_SETTING_KEYS.includes(setting);
        const storageKey = isGlobalSetting ? 'global_reader_settings' : `manga_${manga.id}_reader_settings`;

        // Use getMetadataKey to resolve the actual key to store (e.g. handling profile/device prefixes)
        // Note: getMetadataKey adds prefixes. In our JSON object, we want to store:
        // { "pageScaleMode": "...", "pageScaleMode_1": "..." }
        // getMetadataKey logic: prefix_prefix_key.
        // We probably want to store just the key relative to our settings object.
        // The original logic used getMetadataKey which includes APP_METADATA_KEY_PREFIX and DEVICE.
        // But here we are storing inside a JSON blob that IS our settings container.

        // If we look at `ReaderSettingsMetadata.ts` `convertToSettingsWithDefaultFlag`, it filters out keys that don't match the current device.
        // But for local storage on this specific device, do we need to store device prefix?
        // Probably not, but we DO need profile prefix.

        // Let's implement a simplified key resolution for our local storage JSON object:
        // distinct key = setting + (profile ? `_${profile}` : '')
        // But wait, `getMetadataKey` puts profile in the prefix list? 
        // `getMetadataKey(key, profile ? [profile] : undefined)`
        // -> `suwayomi_webui_device_profile_key`

        // If we want to be compatible with `getReaderSettingsFor`, we should look at how it retrieves data.
        // It generally retrieves the whole metadata object and then `getMetadataFrom` parses specific keys.
        // `getMetadataFrom` looks for keys using `getMetadataKey`.

        // So yes, we should use `getMetadataKey` to generate the key INSIDE our settings object.
        // But `AppStorage` stores the whole object.

        const key = getMetadataKey(setting, profile !== undefined ? [profile?.toString()] : undefined);

        const currentSettings = AppStorage.local.getItemParsed<Record<string, any>>(storageKey, {});
        const newSettings = { ...currentSettings, [key]: value };

        AppStorage.local.setItem(storageKey, newSettings);
    }

    static deleteSetting<Setting extends keyof IReaderSettings>(
        setting: Setting,
        isGlobal: boolean = false,
        profile?: string,
    ): void {
        const { manga: currentManga } = getReaderStore();
        const manga = currentManga ?? (isGlobal ? GLOBAL_READER_SETTINGS_MANGA : currentManga);

        if (!manga || manga.id === FALLBACK_MANGA.id) {
            return;
        }

        const isGlobalSetting = isGlobal || GLOBAL_READER_SETTING_KEYS.includes(setting);
        const storageKey = isGlobalSetting ? 'global_reader_settings' : `manga_${manga.id}_reader_settings`;

        const key = getMetadataKey(setting, profile !== undefined ? [profile] : undefined);

        const currentSettings = AppStorage.local.getItemParsed<Record<string, any>>(storageKey, {});

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [key]: _, ...newSettings } = currentSettings;

        AppStorage.local.setItem(storageKey, newSettings);
    }

    static useOverlayMode(): { mode: ReaderOverlayMode; isDesktop: boolean; isMobile: boolean } {
        const isTouchDevice = MediaQuery.useIsTouchDevice();
        const overlayMode = useReaderSettingsStore((state) => state.settings.overlayMode);

        const isAutoModeSelected = overlayMode === ReaderOverlayMode.AUTO;
        const isDesktopModeSelected = overlayMode === ReaderOverlayMode.DESKTOP;
        const isMobileModeSelected = overlayMode === ReaderOverlayMode.MOBILE;

        const isDesktop = isDesktopModeSelected || (isAutoModeSelected && !isTouchDevice);
        const isMobile = isMobileModeSelected || (isAutoModeSelected && isTouchDevice);

        return {
            mode: isDesktop ? ReaderOverlayMode.DESKTOP : ReaderOverlayMode.MOBILE,
            isDesktop,
            isMobile,
        };
    }

    static useExit(): () => void {
        const exitMode = useReaderSettingsStore((state) => state.settings.exitMode);
        const handleBack = useBackButton();
        const navigate = useNavigate();

        const openMangaPage = useCallback(() => {
            const { manga } = getReaderStore();

            if (!manga) {
                return () => { };
            }

            return navigate(AppRoutes.manga.path(manga.id));
        }, []);

        switch (exitMode) {
            case ReaderExitMode.PREVIOUS:
                return handleBack;
            case ReaderExitMode.MANGA:
                return openMangaPage;
            default:
                throw new Error(`Unexpected "exitMode" (${exitMode})`);
        }
    }
}
