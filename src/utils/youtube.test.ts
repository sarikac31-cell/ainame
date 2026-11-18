import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCleanYouTubeEmbedUrl,
  detectVideoSourceType,
  extractYouTubeVideoId,
} from './youtube';

test('extractYouTubeVideoId parses watch, short, share, and embed URLs', () => {
  assert.equal(
    extractYouTubeVideoId('https://www.youtube.com/watch?v=d-eVhvVN2RY&list=RDbq-tDY4LYKg&index=4'),
    'd-eVhvVN2RY'
  );
  assert.equal(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=abc'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://m.youtube.com/watch?v=abc_123-XYZ'), 'abc_123-XYZ');
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/shorts/9bZkp7q19f0'), '9bZkp7q19f0');
  assert.equal(
    extractYouTubeVideoId('https://www.youtube-nocookie.com/embed/M7lc1UVf-VE'),
    'M7lc1UVf-VE'
  );
  assert.equal(extractYouTubeVideoId('https://example.com/movie.mp4'), null);
  assert.equal(extractYouTubeVideoId('not-a-url'), null);
});

test('buildCleanYouTubeEmbedUrl uses youtube-nocookie and strips native YouTube chrome params', () => {
  const url = buildCleanYouTubeEmbedUrl('d-eVhvVN2RY', 'https://example.com');
  assert.ok(url.startsWith('https://www.youtube-nocookie.com/embed/d-eVhvVN2RY?'));
  assert.ok(url.includes('controls=0'));
  assert.ok(url.includes('rel=0'));
  assert.ok(url.includes('modestbranding=1'));
  assert.ok(url.includes('iv_load_policy=3'));
  assert.ok(url.includes('disablekb=1'));
  assert.ok(url.includes('enablejsapi=1'));
  assert.ok(url.includes('origin=https%3A%2F%2Fexample.com'));
});

test('detectVideoSourceType auto-detects YouTube links as embed and m3u8 as hls', () => {
  assert.equal(detectVideoSourceType('https://www.youtube.com/watch?v=d-eVhvVN2RY'), 'embed');
  assert.equal(detectVideoSourceType('https://youtu.be/dQw4w9WgXcQ'), 'embed');
  assert.equal(detectVideoSourceType('https://cdn.example.com/stream/master.m3u8'), 'hls');
  assert.equal(detectVideoSourceType('https://cdn.example.com/movie.mp4'), 'mp4');
});
