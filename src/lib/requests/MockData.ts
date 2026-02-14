export const MOCK_ABOUT = {
    about: {
        version: "v1.0.0-MOCK",
        serverVersion: "v1.0.0-MOCK",
        gitHash: "mock",
        buildTime: "2024-01-01",
        debug: true,
        buildType: "stable"
    },
    aboutServer: {
        version: "v1.0.0-MOCK",
        serverVersion: "v1.0.0-MOCK",
        gitHash: "mock",
        buildTime: "2024-01-01",
        debug: true,
        buildType: "stable"
    },
    aboutWebUI: {
        tag: "v1.0.0-MOCK",
        channel: "stable",
        updateTimestamp: "0"
    }
};

export const MOCK_EXTENSIONS = {
    extensions: {
        nodes: []
    }
};

export const MOCK_DOWNLOAD_STATUS = {
    downloadStatus: {
        downloaded: 0,
        total: 0,
        errors: 0,
        queue: []
    }
};

export const MOCK_GLOBAL_METADATA = {
    metas: {
        nodes: []
    }
};

export const MOCK_SERVER_SETTINGS = {
    settings: {
        __typename: 'SettingsType',
        ip: "127.0.0.1",
        port: 4567,
        socksProxyEnabled: false,
        socksProxyVersion: "SOCKS5",
        socksProxyHost: "",
        socksProxyPort: 1080,
        socksProxyUsername: "",
        socksProxyPassword: "",
        webUIFlavor: "STABLE",
        initialOpenInBrowserEnabled: false,
        webUIInterface: "0.0.0.0",
        electronPath: "",
        webUIChannel: "STABLE",
        webUIUpdateCheckInterval: 0,
        downloadAsCbz: false,
        downloadsPath: "",
        autoDownloadNewChapters: false,
        excludeEntryWithUnreadChapters: false,
        autoDownloadNewChaptersLimit: 0,
        autoDownloadIgnoreReUploads: false,
        downloadConversions: [],
        serveConversions: [],
        extensionRepos: [],
        maxSourcesInParallel: 1,
        excludeUnreadChapters: false,
        excludeNotStarted: false,
        excludeCompleted: false,
        globalUpdateInterval: 12,
        updateMangas: true,
        authMode: "OFF",
        authPassword: "",
        authUsername: "",
        jwtAudience: "",
        jwtTokenExpiry: 3600,
        jwtRefreshExpiry: 86400,
        debugLogsEnabled: false,
        systemTrayEnabled: false,
        maxLogFileSize: 10,
        maxLogFiles: 10,
        maxLogFolderSize: 100,
        backupPath: "",
        backupTime: "00:00",
        backupInterval: 24,
        backupTTL: 30,
        autoBackupIncludeCategories: true,
        autoBackupIncludeChapters: true,
        autoBackupIncludeClientData: true,
        autoBackupIncludeHistory: true,
        autoBackupIncludeManga: true,
        autoBackupIncludeServerSettings: true,
        autoBackupIncludeTracking: true,
        localSourcePath: "",
        flareSolverrEnabled: false,
        flareSolverrUrl: "",
        flareSolverrTimeout: 60000,
        flareSolverrSessionName: "",
        flareSolverrSessionTtl: 3600,
        flareSolverrAsResponseFallback: false,
        opdsUseBinaryFileSizes: false,
        opdsItemsPerPage: 20,
        opdsEnablePageReadProgress: true,
        opdsMarkAsReadOnDownload: false,
        opdsShowOnlyUnreadChapters: false,
        opdsShowOnlyDownloadedChapters: false,
        opdsChapterSortOrder: "DEFAULT",
        opdsCbzMimetype: "application/x-cbz",
        koreaderSyncChecksumMethod: "MD5",
        koreaderSyncStrategyBackward: "LATEST",
        koreaderSyncStrategyForward: "LATEST",
        koreaderSyncPercentageTolerance: 5,
        databaseType: "SQLITE",
        databaseUrl: "",
        databaseUsername: "",
        databasePassword: "",
        useHikariConnectionPool: false
    }
};

export const MOCK_WEBUI_UPDATE_STATUS = {
    getWebUIUpdateStatus: {
        state: "IDLE", // UpdateState.Idle
        progress: 0,
        info: {
            channel: "stable",
            tag: "v1.0.0-MOCK"
        }
    }
};

export const MOCK_CATEGORIES = {
    categories: {
        nodes: [
            {
                id: -1,
                name: "All",
                order: 0,
                mangas: { totalCount: 0 }
            },
            {
                id: 0,
                name: "Default",
                order: 1,
                mangas: { totalCount: 0 }
            }
        ]
    }
};

export const MOCK_LIBRARY_MANGA_COUNT = {
    mangas: {
        totalCount: 0
    }
};

export const MOCK_CATEGORY_MANGAS = {
    mangas: {
        nodes: []
    }
};
export const MOCK_SOURCE = {
    source: {
        id: "-1",
        name: "Mock Source",
        isConfigurable: false,
        supportsLatest: true,
        baseUrl: "https://example.com"
    }
};

export const MOCK_SOURCE_MANGAS = {
    fetchSourceManga: {
        hasNextPage: false,
        mangas: [
            {
                id: 1,
                title: "Mock Manga 1",
                thumbnailUrl: "https://via.placeholder.com/150",
                favorite: false,
                sourceId: "-1",
                inLibrary: false
            },
            {
                id: 2,
                title: "Mock Manga 2",
                thumbnailUrl: "https://via.placeholder.com/150",
                favorite: false,
                sourceId: "-1",
                inLibrary: false
            }
        ]
    }
};
