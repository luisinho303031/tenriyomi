/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useEffect, useMemo } from 'react';
import { useLocalStorage } from '@/base/hooks/useStorage.tsx';
// eslint-disable-next-line import/no-extraneous-dependencies,no-restricted-imports
import { requestManager } from '@/lib/requests/RequestManager.ts';

import { MangaType } from '@/lib/graphql/generated/graphql.ts';
import { IReaderSettings, IReaderSettingsWithDefaultFlag, ReadingMode } from '@/features/reader/Reader.types.ts';
import { convertFromGqlMeta } from '@/features/metadata/services/MetadataConverter.ts';
import { getMetadataFrom } from '@/features/metadata/services/MetadataReader.ts';
import {
    AllowedMetadataValueTypes,
    GqlMetaHolder,
    Metadata,
    MetadataHolder,
    MetadataHolderType,
} from '@/features/metadata/Metadata.types.ts';
import { defaultPromiseErrorHandler } from '@/lib/DefaultPromiseErrorHandler.ts';
import { MangaIdInfo } from '@/features/manga/Manga.types.ts';
import {
    DEFAULT_READER_SETTINGS,
    GLOBAL_READER_SETTING_KEYS,
} from '@/features/reader/settings/ReaderSettings.constants.tsx';
import { DEFAULT_DEVICE, getActiveDevice } from '@/features/device/services/Device.ts';
import { APP_METADATA_KEY_PREFIX } from '@/features/metadata/Metadata.constants.ts';
import { extractOriginalKey, getMetadataKey } from '@/features/metadata/Metadata.utils.ts';

const convertToSettingsWithDefaultFlag = (
    type: Extract<MetadataHolderType, 'global' | 'manga'>,
    settings: IReaderSettings,
    metadataHolder: MetadataHolder,
): IReaderSettingsWithDefaultFlag => {
    const activeDevice = getActiveDevice();
    const istDefaultDevice = activeDevice === DEFAULT_DEVICE;
    const existingSettings = Object.keys(metadataHolder.meta ?? {})
        // settings that are not for the active device need to be filtered out, otherwise, they mess up the "isDefault" flag
        .filter((metaKey) => {
            // the default device is not added as a prefix to the key, thus, there should only be the app prefix for these reader settings
            if (istDefaultDevice) {
                return metaKey.match(/_/g)?.length === 1;
            }

            return metaKey.startsWith(`${APP_METADATA_KEY_PREFIX}_${activeDevice}_`);
        })
        .map((metaKey) => extractOriginalKey(metaKey));
    const settingsWithDefault = Object.fromEntries(
        (Object.entries(settings) as [keyof IReaderSettings, IReaderSettings[keyof IReaderSettings]][]).map(
            ([key, value]) => {
                const isGlobalSetting = GLOBAL_READER_SETTING_KEYS.includes(key);
                if (isGlobalSetting) {
                    return [key, value];
                }

                const isDefaultSetting = type === 'manga' && !existingSettings.includes(key);
                return [
                    key,
                    {
                        value,
                        isDefault: isDefaultSetting,
                    },
                ];
            },
        ),
    ) as IReaderSettingsWithDefaultFlag;

    return settingsWithDefault;
};

const convertSettingsToMetadata = (
    settings: Partial<IReaderSettings>,
): Metadata<string, AllowedMetadataValueTypes> => ({
    ...settings,
    tapZoneInvertMode: JSON.stringify(settings.tapZoneInvertMode),
    customFilter: JSON.stringify(settings.customFilter),
    readerWidth: JSON.stringify(settings.readerWidth),
    hotkeys: JSON.stringify(settings.hotkeys),
    autoScroll: JSON.stringify(settings.autoScroll),
});

export const DEFAULT_READER_SETTINGS_WITH_DEFAULT_FLAG = convertToSettingsWithDefaultFlag(
    'global',
    DEFAULT_READER_SETTINGS,
    { meta: convertSettingsToMetadata(DEFAULT_READER_SETTINGS) as Metadata },
);

export const getReaderSettings = (
    type: Extract<MetadataHolderType, 'global' | 'manga'>,
    metadataHolder: (MangaIdInfo & MetadataHolder) | MetadataHolder,
    defaultSettings: IReaderSettings = DEFAULT_READER_SETTINGS,
    useEffectFn?: typeof useEffect,
    profile?: ReadingMode,
): IReaderSettings =>
    getMetadataFrom(
        type as Parameters<typeof getMetadataFrom>[0],
        metadataHolder as Parameters<typeof getMetadataFrom>[1],
        defaultSettings,
        profile !== undefined ? [profile.toString()] : undefined,
        useEffectFn,
    );

function getReaderSettingsWithDefaultValueFallback(
    type: 'global',
    metadataHolder: MetadataHolder,
    defaultSettings?: IReaderSettings,
    useEffectFn?: typeof useEffect,
    profile?: ReadingMode,
): IReaderSettingsWithDefaultFlag;
function getReaderSettingsWithDefaultValueFallback(
    type: 'manga',
    metadataHolder: MangaIdInfo & MetadataHolder,
    defaultSettings?: IReaderSettings,
    useEffectFn?: typeof useEffect,
    profile?: ReadingMode,
): IReaderSettingsWithDefaultFlag;
function getReaderSettingsWithDefaultValueFallback(
    type: Extract<MetadataHolderType, 'global' | 'manga'>,
    metadataHolder: (MangaIdInfo & MetadataHolder) | MetadataHolder,
    defaultSettings: IReaderSettings = DEFAULT_READER_SETTINGS,
    useEffectFn?: typeof useEffect,
    profile?: ReadingMode,
): IReaderSettingsWithDefaultFlag {
    const settings = getReaderSettings(type, metadataHolder, defaultSettings, useEffectFn, profile);
    return convertToSettingsWithDefaultFlag(type, settings, metadataHolder);
}

const getSettings = (
    metaHolder: MangaIdInfo & GqlMetaHolder,
    defaultSettings?: IReaderSettings,
    useEffectFn?: typeof useEffect,
    profile?: ReadingMode,
): IReaderSettingsWithDefaultFlag =>
    getReaderSettingsWithDefaultValueFallback(
        'manga',
        {
            ...metaHolder,
            meta: convertFromGqlMeta(
                metaHolder.meta,
                (key) => !GLOBAL_READER_SETTING_KEYS.includes(extractOriginalKey(key)),
            ),
        },
        defaultSettings,
        useEffectFn,
        profile,
    );

export const getReaderSettingsFor = (
    metaHolder: MangaIdInfo & GqlMetaHolder,
    defaultSettings: IReaderSettings,
): IReaderSettingsWithDefaultFlag => getSettings(metaHolder, defaultSettings);

export const useGetReaderSettingsFor = (
    metaHolder: MangaIdInfo & GqlMetaHolder,
    defaultSettings: IReaderSettings,
    profile?: ReadingMode,
): IReaderSettingsWithDefaultFlag => {
    const [globalSettings] = useLocalStorage<Partial<IReaderSettings>>('global_reader_settings', {});
    const [mangaSettings] = useLocalStorage<Partial<IReaderSettings>>(`manga_${metaHolder.id}_reader_settings`, {});

    const settings = useMemo(() => {
        const mergedGlobal = { ...defaultSettings, ...globalSettings };
        const mergedManga = { ...mergedGlobal, ...mangaSettings };

        const result: Partial<IReaderSettingsWithDefaultFlag> = {};
        const allSettingKeys = Object.keys(DEFAULT_READER_SETTINGS) as Array<keyof IReaderSettings>;

        for (const key of allSettingKeys) {
            const isGlobalKey = GLOBAL_READER_SETTING_KEYS.includes(key);

            // Resolve the effective value.
            // 1. Try profile-specific key.
            const effectiveKey = getMetadataKey(key, profile !== undefined ? [profile.toString()] : undefined);
            // 2. Try default key (raw key).
            const defaultKey = getMetadataKey(key, undefined);

            let val = mergedManga[key]; // Default (from DEFAULT_READER_SETTINGS or simple key in storage)

            // Check for saved generic value
            if (Object.prototype.hasOwnProperty.call(mergedManga, defaultKey)) {
                const override = mergedManga[defaultKey as keyof typeof mergedManga];
                if (override !== undefined && override !== null) {
                    val = override;
                }
            }

            // Check for saved profile value
            if (Object.prototype.hasOwnProperty.call(mergedManga, effectiveKey)) {
                const override = mergedManga[effectiveKey as keyof typeof mergedManga];
                if (override !== undefined && override !== null) {
                    val = override;
                }
            }

            // Fallback to default if val is still somehow undefined/null (e.g. corruption)
            if (val === undefined || val === null) {
                val = DEFAULT_READER_SETTINGS[key];
            }

            if (isGlobalKey) {
                // @ts-ignore
                result[key] = val;
            } else {
                // If the value came from specific keys, it's not default.
                // If it came from `mergedManga[key]` (which comes from DEFAULT or simple key match), it is default.

                const hasExplicitValue =
                    Object.prototype.hasOwnProperty.call(mergedManga, effectiveKey) ||
                    Object.prototype.hasOwnProperty.call(mergedManga, defaultKey) ||
                    // Also check if simple key exists in mangaSettings (meaning explicit override without prefix logic, possibly from old logic or simple writes)
                    (mangaSettings && Object.prototype.hasOwnProperty.call(mangaSettings, key));

                // @ts-ignore
                result[key] = {
                    value: val,
                    isDefault: !hasExplicitValue,
                };
            }
        }
        return result as IReaderSettingsWithDefaultFlag;
    }, [defaultSettings, globalSettings, mangaSettings, profile]);

    return settings;
};

export const useDefaultReaderSettings = (
    profile?: ReadingMode,
): {
    metadata?: Metadata;
    settings: IReaderSettings;
    loading: boolean;
    request: ReturnType<typeof requestManager.useGetGlobalMeta>;
} => {
    const request = requestManager.useGetGlobalMeta({ notifyOnNetworkStatusChange: true });
    const { data, loading } = request;
    const metadata = useMemo(() => convertFromGqlMeta(data?.metas.nodes), [data?.metas.nodes]);
    const metaHolder: MetadataHolder = useMemo(() => ({ meta: metadata }), [metadata]);
    const tmpSettings = getReaderSettings('global', metaHolder, undefined, useEffect, profile);
    const settings = useMemo(() => tmpSettings, [metaHolder, profile]);

    return useMemo(
        () => ({
            metadata,
            settings,
            loading,
            request,
        }),
        [metadata, settings, loading, request],
    );
};

export const useDefaultReaderSettingsWithDefaultFlag = (
    profile?: ReadingMode,
): {
    metadata?: Metadata;
    settings: IReaderSettingsWithDefaultFlag;
    loading: boolean;
    request: ReturnType<typeof requestManager.useGetGlobalMeta>;
} => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [localSettings] = useLocalStorage<Partial<IReaderSettings>>('global_reader_settings', {});

    const settings = useMemo(() => {
        const merged = { ...DEFAULT_READER_SETTINGS, ...localSettings };

        const result: Partial<IReaderSettingsWithDefaultFlag> = {};
        const allSettingKeys = Object.keys(DEFAULT_READER_SETTINGS) as Array<keyof IReaderSettings>;

        // For global settings, we mainly want to resolve the value.
        // The original logic used convertToSettingsWithDefaultFlag which returned values directly for global keys.

        for (const key of allSettingKeys) {
            const isGlobalKey = GLOBAL_READER_SETTING_KEYS.includes(key);

            // 1. Try profile-specific key (if profile is provided, though usually undefined for global settings page?)
            const effectiveKey = getMetadataKey(key, profile !== undefined ? [profile.toString()] : undefined);
            // 2. Try default key (raw key with prefix but no profile)
            const defaultKey = getMetadataKey(key, undefined);

            let val = merged[key]; // Start with default

            // Check for saved generic value
            if (Object.prototype.hasOwnProperty.call(merged, defaultKey)) {
                const override = merged[defaultKey as keyof typeof merged];
                if (override !== undefined && override !== null) {
                    val = override;
                }
            }

            // Check for saved profile value
            if (Object.prototype.hasOwnProperty.call(merged, effectiveKey)) {
                const override = merged[effectiveKey as keyof typeof merged];
                if (override !== undefined && override !== null) {
                    val = override;
                }
            }

            // Fallback to default if val is still somehow undefined/null (e.g. corruption)
            if (val === undefined || val === null) {
                val = DEFAULT_READER_SETTINGS[key];
            }

            // Global settings page expects direct values for global keys (not wrapped in {value, isDefault})
            // For non-global keys (like tapZoneInvertMode), they must be wrapped because the type IReaderSettingsWithDefaultFlag demands it.

            if (isGlobalKey) {
                // @ts-ignore
                result[key] = val;
            } else {
                // For global default settings, isDefault is effectively always false (or true? doesn't matter much for global edit, usually treated as explicit).
                // In convertToSettingsWithDefaultFlag: 
                // const isDefaultSetting = type === 'manga' && !existingSettings.includes(key);
                // If type === 'global', isDefaultSetting is false.

                // @ts-ignore
                result[key] = {
                    value: val,
                    isDefault: false,
                };
            }
        }

        return result as IReaderSettingsWithDefaultFlag;
    }, [localSettings, profile]);

    // Mock request
    const request = useMemo(() => ({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: async () => ({ data: undefined, loading: false, error: undefined, networkStatus: 7 }),
        client: requestManager.graphQLClient.client,
    } as any), []);

    return { metadata: undefined, settings, loading: false, request };
};

export const updateReaderSettings = async <Setting extends keyof IReaderSettings = keyof IReaderSettings>(
    manga: Pick<MangaType, 'id'> & GqlMetaHolder,
    setting: Setting,
    value: IReaderSettings[Setting],
    isGlobal: boolean = false,
    profile?: ReadingMode,
): Promise<void[]> => {
    // This function is kept for compatibility but should not be reached if ReaderService uses AppStorage directly.
    return Promise.resolve([]);
};

export const createUpdateReaderSettings =
    <Settings extends keyof IReaderSettings>(
        manga: Pick<MangaType, 'id'> & GqlMetaHolder,
        handleError: (error: any) => void = defaultPromiseErrorHandler('createUpdateReaderSettings'),
        profile?: ReadingMode,
    ): ((...args: OmitFirst<Parameters<typeof updateReaderSettings<Settings>>>) => Promise<void | void[]>) =>
        (setting, value, isGlobal) =>
            updateReaderSettings(manga, setting, value, isGlobal, profile).catch(handleError);
