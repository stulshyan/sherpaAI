// S3 Storage Service for file operations

import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
  PutObjectCommandInput,
  GetObjectCommandInput,
  _Object,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { detectContentType } from '../utils/s3-keys.js';

/**
 * Storage service configuration
 */
export interface StorageConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string; // For LocalStack or S3-compatible services
}

/**
 * Upload options
 */
export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  cacheControl?: string;
  contentEncoding?: string;
}

/**
 * Download result
 */
export interface DownloadResult {
  content: Buffer;
  contentType?: string;
  contentLength?: number;
  metadata?: Record<string, string>;
  lastModified?: Date;
}

/**
 * Object info
 */
export interface ObjectInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
}

/**
 * List objects result
 */
export interface ListObjectsResult {
  objects: ObjectInfo[];
  continuationToken?: string;
  isTruncated: boolean;
}

/**
 * S3 Storage Service
 */
export class StorageService {
  private s3: S3Client;
  private defaultBucket: string;

  constructor(config: StorageConfig, defaultBucket?: string) {
    const s3Config: {
      region: string;
      credentials?: { accessKeyId: string; secretAccessKey: string };
      endpoint?: string;
      forcePathStyle?: boolean;
    } = {
      region: config.region,
    };

    if (config.accessKeyId && config.secretAccessKey) {
      s3Config.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };
    }

    if (config.endpoint) {
      s3Config.endpoint = config.endpoint;
      s3Config.forcePathStyle = true; // Required for LocalStack
    }

    this.s3 = new S3Client(s3Config);
    this.defaultBucket = defaultBucket || '';
  }

  /**
   * Initialize storage service from environment variables
   */
  static fromEnv(defaultBucket?: string): StorageService {
    const config: StorageConfig = {
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      endpoint: process.env.S3_ENDPOINT, // For LocalStack
    };
    return new StorageService(config, defaultBucket);
  }

  /**
   * Upload content to S3
   */
  async upload(
    key: string,
    content: Buffer | string | Readable,
    options?: UploadOptions,
    bucket?: string
  ): Promise<string> {
    const targetBucket = bucket || this.defaultBucket;
    if (!targetBucket) {
      throw new Error('Bucket name required');
    }

    const commandInput: PutObjectCommandInput = {
      Bucket: targetBucket,
      Key: key,
      Body: content,
      ContentType: options?.contentType || detectContentType(key),
      Metadata: options?.metadata,
      CacheControl: options?.cacheControl,
      ContentEncoding: options?.contentEncoding,
    };

    if (options?.tags) {
      commandInput.Tagging = Object.entries(options.tags)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    }

    const command = new PutObjectCommand(commandInput);
    await this.s3.send(command);

    return `s3://${targetBucket}/${key}`;
  }

  /**
   * Upload JSON object to S3
   */
  async uploadJson(
    key: string,
    data: unknown,
    options?: Omit<UploadOptions, 'contentType'>,
    bucket?: string
  ): Promise<string> {
    const content = JSON.stringify(data, null, 2);
    return this.upload(key, content, { ...options, contentType: 'application/json' }, bucket);
  }

  /**
   * Download content from S3
   */
  async download(key: string, bucket?: string): Promise<DownloadResult | null> {
    const targetBucket = bucket || this.defaultBucket;
    if (!targetBucket) {
      throw new Error('Bucket name required');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      const response = await this.s3.send(command);

      if (!response.Body) {
        return null;
      }

      const content = await this.streamToBuffer(response.Body as Readable);

      return {
        content,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        metadata: response.Metadata,
        lastModified: response.LastModified,
      };
    } catch (error: unknown) {
      if ((error as { name?: string }).name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Download and parse JSON from S3
   */
  async downloadJson<T = unknown>(key: string, bucket?: string): Promise<T | null> {
    const result = await this.download(key, bucket);
    if (!result) {
      return null;
    }
    return JSON.parse(result.content.toString('utf-8')) as T;
  }

  /**
   * Check if object exists
   */
  async exists(key: string, bucket?: string): Promise<boolean> {
    const targetBucket = bucket || this.defaultBucket;
    if (!targetBucket) {
      throw new Error('Bucket name required');
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });
      await this.s3.send(command);
      return true;
    } catch (error: unknown) {
      if ((error as { name?: string }).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get object metadata
   */
  async getMetadata(
    key: string,
    bucket?: string
  ): Promise<{
    size: number;
    lastModified: Date;
    contentType?: string;
    metadata?: Record<string, string>;
  } | null> {
    const targetBucket = bucket || this.defaultBucket;
    if (!targetBucket) {
      throw new Error('Bucket name required');
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });
      const response = await this.s3.send(command);

      return {
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date(),
        contentType: response.ContentType,
        metadata: response.Metadata,
      };
    } catch (error: unknown) {
      if ((error as { name?: string }).name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete object from S3
   */
  async delete(key: string, bucket?: string): Promise<void> {
    const targetBucket = bucket || this.defaultBucket;
    if (!targetBucket) {
      throw new Error('Bucket name required');
    }

    const command = new DeleteObjectCommand({
      Bucket: targetBucket,
      Key: key,
    });
    await this.s3.send(command);
  }

  /**
   * Copy object within S3
   */
  async copy(
    sourceKey: string,
    destinationKey: string,
    sourceBucket?: string,
    destinationBucket?: string
  ): Promise<string> {
    const srcBucket = sourceBucket || this.defaultBucket;
    const destBucket = destinationBucket || this.defaultBucket;

    if (!srcBucket || !destBucket) {
      throw new Error('Bucket names required');
    }

    const command = new CopyObjectCommand({
      CopySource: `${srcBucket}/${sourceKey}`,
      Bucket: destBucket,
      Key: destinationKey,
    });
    await this.s3.send(command);

    return `s3://${destBucket}/${destinationKey}`;
  }

  /**
   * List objects with prefix
   */
  async list(
    prefix: string,
    bucket?: string,
    maxKeys: number = 1000,
    continuationToken?: string
  ): Promise<ListObjectsResult> {
    const targetBucket = bucket || this.defaultBucket;
    if (!targetBucket) {
      throw new Error('Bucket name required');
    }

    const command = new ListObjectsV2Command({
      Bucket: targetBucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    });

    const response = await this.s3.send(command);

    const objects: ObjectInfo[] = (response.Contents || []).map((obj: _Object) => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
      etag: obj.ETag,
    }));

    return {
      objects,
      continuationToken: response.NextContinuationToken,
      isTruncated: response.IsTruncated || false,
    };
  }

  /**
   * List all objects with prefix (handles pagination)
   */
  async listAll(prefix: string, bucket?: string): Promise<ObjectInfo[]> {
    const allObjects: ObjectInfo[] = [];
    let continuationToken: string | undefined;

    do {
      const result = await this.list(prefix, bucket, 1000, continuationToken);
      allObjects.push(...result.objects);
      continuationToken = result.continuationToken;
    } while (continuationToken);

    return allObjects;
  }

  /**
   * Generate presigned URL for upload
   */
  async getUploadUrl(
    key: string,
    expiresIn: number = 3600,
    contentType?: string,
    bucket?: string
  ): Promise<string> {
    const targetBucket = bucket || this.defaultBucket;
    if (!targetBucket) {
      throw new Error('Bucket name required');
    }

    const commandInput: PutObjectCommandInput = {
      Bucket: targetBucket,
      Key: key,
    };

    if (contentType) {
      commandInput.ContentType = contentType;
    }

    const command = new PutObjectCommand(commandInput);
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  /**
   * Generate presigned URL for download
   */
  async getDownloadUrl(key: string, expiresIn: number = 3600, bucket?: string): Promise<string> {
    const targetBucket = bucket || this.defaultBucket;
    if (!targetBucket) {
      throw new Error('Bucket name required');
    }

    const commandInput: GetObjectCommandInput = {
      Bucket: targetBucket,
      Key: key,
    };

    const command = new GetObjectCommand(commandInput);
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  /**
   * Convert stream to buffer
   */
  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Get the underlying S3 client
   */
  getClient(): S3Client {
    return this.s3;
  }
}

/**
 * Create a storage service instance
 */
export function createStorageService(
  config?: StorageConfig,
  defaultBucket?: string
): StorageService {
  if (config) {
    return new StorageService(config, defaultBucket);
  }
  return StorageService.fromEnv(defaultBucket);
}
