import { z } from 'zod';

const spotifyTrackUrlPattern = /^(spotify:track:[A-Za-z0-9]{22}|https?:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]{22}(?:[/?].*)?)$/i;

export const spotifyMetadataBodySchema = z.object({
  body: z.object({
    url: z
      .string()
      .min(1, 'Spotify URL is required')
      .refine((value) => spotifyTrackUrlPattern.test(value), {
        message: 'Invalid Spotify track URL or URI',
      }),
    actualName: z.string().min(1, 'actualName is required'),
    stageName: z.string().min(1, 'stageName is required'),
  }),
});
