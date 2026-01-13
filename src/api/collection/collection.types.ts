export type OwnerType = 'system' | 'gallery_user';
export type Visibility = 'private' | 'public';
export type CollectionAction =
    | 'created' | 'updated' | 'project_added' | 'project_removed'
    | 'project_reordered' | 'visibility_changed' | 'featured_changed'
    | 'cloned' | 'deleted' | 'restored';

export interface Collection {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    tags: string[];
    ownerId: string | null;
    ownerType: OwnerType;
    visibility: Visibility;
    featured: boolean;
    clonedFromId: string | null;
    isDeleted: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface CollectionProject {
    id: string;
    collectionId: string;
    projectId: string;
    position: number;
    addedAt: Date;
    addedBy: string | null;
    notes: string | null;
}

export interface CollectionStats {
    id: string;
    collectionId: string;
    views: number;
    uniqueVisitors: number;
    clones: number;
    projectClicks: number;
    lastViewedAt: Date | null;
    updatedAt: Date;
}

export interface CollectionActivity {
    id: string;
    collectionId: string;
    action: CollectionAction;
    actorId: string | null;
    actorType: 'admin' | 'gallery_user' | 'system';
    details: Record<string, any> | null;
    createdAt: Date;
}

// DTOs
export interface CreateCollectionDTO {
    title: string;
    description: string;
    thumbnail: string;
    tags?: string[];
    visibility?: Visibility;
}

export interface UpdateCollectionDTO {
    title?: string;
    description?: string;
    thumbnail?: string;
    tags?: string[];
    visibility?: Visibility;
    featured?: boolean;
}

export interface AddProjectDTO {
    projectId: string;
    position?: number;
    notes?: string;
}

export interface ReorderProjectsDTO {
    projectIds: string[]; // Ordered list of project IDs
}

export interface CollectionShareMetadata {
    title: string;
    description: string;
    image: string;
    url: string;
    embedCode: string;
    ogTags: {
        'og:title': string;
        'og:description': string;
        'og:image': string;
        'og:url': string;
        'og:type': string;
        'og:site_name': string;
    };
    twitterTags: {
        'twitter:card': string;
        'twitter:title': string;
        'twitter:description': string;
        'twitter:image': string;
    };
}

