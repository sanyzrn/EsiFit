/** JSON contracts shared by the community API and its existing view. */
export type CommunityComment = { id: string; content: string; author: string };
export type CommunityPost = {
  id: string;
  content: string;
  workoutType: string | null;
  createdAt: string;
  author: { id: string; name: string; tier: string };
  liked: boolean;
  isOwner: boolean;
  likeCount: number;
  commentCount: number;
  comments: CommunityComment[];
};
export type CommunityFeed = {
  posts: CommunityPost[];
  nextCursor: string | null;
};
