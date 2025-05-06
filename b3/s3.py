from boto3 import client as boto_client
from botocore.config import Config

from pathlib import Path


def get_filesize_str(file_size, precision=0):
    """
    Convert file size in bytes to a human-readable string.
    :param file_size: (int) File size in bytes
    :param precision: (int) Number of decimal places to display
    :return: (str) Human-readable file size string
    """

    size_strings = ['B', 'KB', 'MB', 'GB', 'TB']
    size_index = 0
    while file_size >= 1024 and size_index < 4:
        size_index += 1 
        file_size = file_size / 1024  
    return "%.*f %s" % (precision, file_size, size_strings[size_index])


class S3:
    __handles = []

    @staticmethod
    def delete_handle(bucket_name):
        """
        Delete the S3 handle for the specified bucket name.
        :param bucket_name: (str) S3 bucket name
        """
        S3.__handles = [h for h in S3.__handles if h['bucket'] != bucket_name]

        
    def __init__(self, key_pair, service_provider, service_region, bucket_name=None):
        """
        Initialize the S3 client with the provided credentials and service provider.
        :param key_pair: (str) Key pair in the format 'key_id:key_secret'
        :param service_provider: (str) Service provider ('aws' or 'backblaze')
        :param service_region: (str) Service region (e.g., 'us-west-1')
        """

        if bucket_name:
            handle = next((h for h in self.__handles if h['bucket'] == bucket_name), None)
            if handle:
                self.client = handle['handle']
                return
            
        key_id, key_secret = key_pair
  
        if service_provider == 'aws':
            url = 'https://S3.' + service_region +'.amazonaws.com'
        elif service_provider == 'backblaze':
            url = 'https://S3.' + service_region +'.backblazeb2.com'
        else:
            raise ValueError("Unsupported service. Use 'aws' or 'backblaze'.")


        self.client = boto_client("s3", region_name=service_region, aws_access_key_id=key_id,
                              aws_secret_access_key=key_secret, endpoint_url=url, 
                              config=Config(signature_version='s3v4'))
        
        # Remove any existing handle for the same bucket
        self.__handles = [h for h in self.__handles if h['bucket'] != bucket_name]
        
        self.__handles.append({'bucket': bucket_name, 'handle': self.client})

    def get_object_list(self, bucket_name, path_prefix, delimiter='', raw_list=False):
        """
        list objects (files and folders) in an S3 bucket with a specific prefix. 
        It retrieves the contents of a bucket, optionally grouped by a delimiter, 
        and can return either raw data or a processed list of folders and files
        :param bucket_name: (str) S3 bucket name
        :param path_prefix: (str) Prefix to filter objects
        :param delimiter: (str) Delimiter to group objects (e.g., '/')
        :param raw_list: (bool) If True, return raw object list
        :return: (list) List of objects or folders
        """


        contents = []
        common_prefixes = []
        arg_list = {"Bucket": bucket_name, "Prefix": path_prefix, "Delimiter": delimiter}
        while True:
            response = self.client.list_objects_v2(**arg_list)
            c = response.get('Contents')
            if c:
                contents += c

            p = response.get('CommonPrefixes')
            if p:
                common_prefixes += p

            # Check if there are more results to fetch
            paginator = response.get("NextContinuationToken")
            if paginator:
                arg_list["ContinuationToken"] = paginator
            else:
                break

        if raw_list:
            return contents
        
        folders = [item['Prefix'] for item in common_prefixes]
        files = [{'name': item['Key'], 'size': get_filesize_str(item['Size'], 2),
                  'date': item['LastModified']} for item in contents if item['Key'] != path_prefix]
        return folders, files

    def generate_presigned_url(self, bucket, key, method, expires_in=300, upload_id=None, part_number=None):
        """
        Helper method to generate presigned URLs.
        :param bucket: (str) S3 bucket name
        :param key: (str) S3 object key
        :param method: (str) S3 operation (e.g., 'get_object', 'upload_part')
        :param expires_in: (int) Expiration time in seconds
        :param upload_id: (str) Upload ID for multipart uploads (optional)
        :param part_number: (int) Part number for multipart uploads (optional)
        :return: (str) Presigned URL
        """
        params = {'Bucket': bucket, 'Key': key}
        if upload_id and part_number:
            params.update({'UploadId': upload_id, 'PartNumber': part_number})
        return self.client.generate_presigned_url(method, Params=params, ExpiresIn=expires_in)

    def get_signed_url(self, folders, files, method='get_object'):
        """
        Generate presigned URLs for folders and files.
        :param folders: (list) List of folder paths
        :param files: (list) List of file paths
        :param method: (str) S3 operation (e.g., 'get_object', 'put_object')
        :return: (list) List of presigned URLs
        """
        url_list = []

        # Process folders
        for folder in folders:
            
            _bucket_name, _key = self.parse_obj_path(folder)
            _folder_path = _key if _key[-1] == '/' else _key + '/'

            _contents = self.get_object_list(_bucket_name, _folder_path, raw_list=True)

            for _content in _contents:
                if _content['Key'][-1] != '/':
                    _token = self.generate_presigned_url(
                        _bucket_name, _content['Key'], method, expires_in=300
                    )

                    url_list.append({
                        'path': Path(_content['Key']).relative_to(Path(_folder_path).parent).as_posix(),
                        'token': _token
                    })

        # Process files
        for _file in files:
            _bucket_name, _key = self.parse_obj_path(_file)

            _token = self.generate_presigned_url(
                _bucket_name, _key, method, expires_in=3000
            )

            url_list.append({
                'path': _key.rsplit('/', 1)[-1],
                'token': _token,
            })

        return url_list
    
    def start_upload(self, files, upload_chunk_size):
        """
        Start a multipart upload for the specified files.
        :param files: (list) List of file paths and sizes
        :param upload_chunk_size: (int) Chunk size for multipart uploads
        :return: (list) List of presigned URLs for each part
        """
        url_list = []

        for _file in files:
            _bucket_name, _key = self.parse_obj_path(_file[0])
            res = self.client.create_multipart_upload(Bucket=_bucket_name, Key=_key)
            upload_id = res['UploadId']
            total_chunks = (_file[1] + upload_chunk_size - 1) // upload_chunk_size
            _token = [
                self.generate_presigned_url(
                    _bucket_name, _key, 'upload_part', expires_in=3600,
                    upload_id=upload_id, part_number=part
                )
                for part in range(1, total_chunks + 1)
            ]

            url_list.append({
                'token': _token,
                'upload_id': upload_id
            })

        return url_list

    def complete_upload(self, bucket_name, obj_path, upload_id, parts):
        """
        Finalise the multipart upload by sending the list of parts to S3.
        :param bucket: (str) S3 bucket name
        :param obj_path: (str) S3 object key
        :param upload_id: (str) Upload ID for the multipart upload
        :param parts: (list) List of parts to be uploaded
        :return: None
        """

        try:
            self.client.complete_multipart_upload(Bucket=bucket_name, Key=obj_path, UploadId=upload_id, MultipartUpload={'Parts': parts})
            
        except Exception as e:
            print(f'Error finalising {e}')
            self.client.abort_multipart_upload(Bucket=bucket_name, Key=obj_path, UploadId=upload_id)

    def parse_obj_path(self, obj_path):
        """
        Parse the object path to extract bucket name and key.
        :param obj_path: (str) S3 object path
        :return: (tuple) Bucket name and key
        """
        _obj_p = Path(obj_path)
        _bucket_name = _obj_p.parts[0]
        _key = _obj_p.relative_to(_bucket_name).as_posix()
        return _bucket_name, _key


    def prepare_delete(self, folders, file_list):
        """
        Prepare a list of files and folders to be deleted from S3 bucket.
        :param folders: (list) List of folder paths
        :param file_list: (list) List of file paths
        :return: (list) List of files to be deleted
        """
        delete_list = []

        # Walk through the folders and get their contents
        # and add them to the delete list
        for folder in folders:
            _bucket_name, _key = self.parse_obj_path(folder)
            _folder_path = _key if _key[-1] == '/' else _key + '/'
            _, _contents = self.get_object_list(_bucket_name, _folder_path)
            delete_list += [_bucket_name+'/'+item['name'] for item in _contents]

        # Files are already in the correct format
        # so we can just append them to the delete list
        delete_list.extend(file_list)

        return delete_list
    
    def initiate_delete(self, delete_list):
        """
        Initiate the deletion of files and folders from S3 bucket.
        :param delete_list: (list) List of files and folders to be deleted
        """

        for item in delete_list:
            _bucket_name, _key = self.parse_obj_path(item)
            print(_bucket_name, _key)
            self.client.delete_object(Bucket=_bucket_name, Key=_key)
        


