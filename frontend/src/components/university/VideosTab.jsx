/**
 * University Module - Videos Tab Component
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../shared/ui/card';
import { PlayCircle, ExternalLink } from 'lucide-react';

const VideoCard = ({ video }) => (
  <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
    {video.thumbnail && (
      <div className="relative h-40 bg-gray-200">
        <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <PlayCircle className="w-12 h-12 text-gray-900" />
        </div>
      </div>
    )}
    <CardContent className="p-4">
      <h3 className="font-semibold text-gray-900 mb-1">{video.title}</h3>
      {video.duration && (
        <p className="text-sm text-gray-500">{video.duration}</p>
      )}
    </CardContent>
  </Card>
);

const PlaylistCard = ({ playlist }) => (
  <Card className="dark:bg-white">
    <CardHeader>
      <CardTitle className="text-lg">{playlist.name}</CardTitle>
      <CardDescription className="dark:text-gray-600">
        {playlist.video_count || 0} videos
      </CardDescription>
    </CardHeader>
    <CardContent>
      {playlist.url && (
        <a 
          href={playlist.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-orange-600 text-sm hover:underline"
        >
          View Playlist <ExternalLink className="w-4 h-4 ml-1" />
        </a>
      )}
    </CardContent>
  </Card>
);

export const VideosTab = ({ videoSources }) => {
  const { sources = [], playlists = [] } = videoSources;

  if (sources.length === 0 && playlists.length === 0) {
    return (
      <Card className="dark:bg-white">
        <CardContent className="p-12 text-center">
          <PlayCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Videos Yet
          </h3>
          <p className="text-gray-600">
            Video content will appear here once configured by your administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Playlists Section */}
      {playlists.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Video Playlists
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playlists.map((playlist, index) => (
              <PlaylistCard key={playlist.id || index} playlist={playlist} />
            ))}
          </div>
        </div>
      )}

      {/* Individual Videos Section */}
      {sources.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Training Videos
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sources.map((video, index) => (
              <VideoCard key={video.id || index} video={video} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideosTab;
