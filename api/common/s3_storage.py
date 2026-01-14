import os
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


def get_s3_client():
    # signature_version настраивается в boto3 Config (по умолчанию SigV4, можно явно указать)
    # :contentReference[oaicite:5]{index=5}
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("S3_ENDPOINT_URL"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
        config=Config(signature_version="s3v4"),
    )


def ensure_bucket_exists(s3, bucket: str):
    try:
        s3.head_bucket(Bucket=bucket)
    except ClientError:
        # create_bucket — стандартная операция S3 API :contentReference[oaicite:6]{index=6}
        s3.create_bucket(Bucket=bucket)


def upload_fileobj_to_s3(fileobj, bucket: str, key: str, content_type: str | None = None):
    s3 = get_s3_client()
    ensure_bucket_exists(s3, bucket)

    extra = {}
    if content_type:
        extra["ContentType"] = content_type

    # upload_fileobj — managed transfer, может делать multipart :contentReference[oaicite:7]{index=7}
    s3.upload_fileobj(fileobj, bucket, key, ExtraArgs=extra or None)
