export type Post = {
  id: string;
  imageUrl: string;
  thumbUrl: string;
  caption: string;
  hashtags: string[];
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: string;
  author: { id: string; username: string; avatarUrl: string | null };
};

export type Comment = { id: string; text: string; createdAt: string; username: string };

export type AppNotification = {
  type: "like" | "comment" | "follow";
  fromUsername: string;
  postId?: string;
  createdAt: string;
};
