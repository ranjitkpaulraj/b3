# `b3` - Backblaze Browser

## Overview
 `b3` is a Django-based web application designed to provide a user-friendly interface for browsing files stored in Backblaze B2. Its frontend UI delivers a file manager-style experience, while the backend fetches objects using S3-compatible APIs. This allows `b3` to seamlessly support various S3-compatible object storage services, such as AWS S3, DigitalOcean Spaces, Wasabi, and more.

While Backblaze provides a web-based file browser for bucket contents, it requires sharing a single set of login credentials among users, exposing security keys and account management features. `b3` addresses this issue by securely storing secret keys in the backend environment and implementing access control using Django's built-in user management system.

Additionally, `b3` simplifies bucket and object management with essential features, including file uploads, downloads, deletions, and intuitive folder navigation

## Features
- **Bucket Management**: Browse and manage buckets and their contents.
- **File Operations**: Upload, download, and delete files and folders.
- **Drag-and-Drop Uploads**: Easily upload files and folders using drag-and-drop functionality.
- **Presigned URLs**: Uses presigned urls for download and upload to avoid network load at backend.
- **Folder Navigation**: Navigate through folders and subfolders with an intuitive interface.
- **Progress Tracking**: Monitor upload and download progress in real-time.
- **Cross-Provider Support**: Works with any S3-compatible storage provider.
- **Browser Compatibility**: Supports modern browsers with fallback options for older ones.


## Requirements
- Python 3.8+
- Django 5.2
- S3-compatible storage credentials
- `sslserver` package for local HTTPS development

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/b3.git
cd b3
```

### 2. Set Up a Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory and add the following variables:
```env
SECRET_KEY=your_django_secret_key
S3_KEY=your_s3_access_key
S3_SECRET=your_s3_secret_key
S3_REGION=your_s3_region
S3_PROVIDER=aws  # or backblaze, digitalocean, etc.
```

### 5. Apply Migrations
```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Create a Superuser
```bash
python manage.py createsuperuser
```

### 7. Run the Development Server
Start the server
```bash
python manage.py runsslserver
```

If you have certificate for your server run as
```bash
python manage.py runsslserver --certificate /path/to/certificate --key /path/to/key
```

Self-signed often causes browser trust warnings and CORS issues.
During development creating local CA would be ideal.
[mkcert](https://github.com/FiloSottile/mkcert) is handy tool for this purpose.

### 8. Production Deployment
Follow [Django deployment guide](https://docs.djangoproject.com/en/5.2/howto/deployment/) to deploy as production server.

Database usage is minimal, so the default sqlite is good enough. 

## Usage

### Admin Login
1. Access the admin page at `https://127.0.0.1:8000/admin`
2. Create buckets and users

### User Login
Access the user page at `https://127.0.0.1:8000/`


### Bucket Management
- **View Buckets**: All available buckets are listed in the left panel.
- **Expand Folders**: Click on the caret icon to expand folders and view their contents.
- **Navigate**: Click on a folder or bucket to view its contents in the right panel.

### File Operations
- **Upload Files/Folders**: 
  - Click the upload button and choose files or folders.
  - Alternatively, drag and drop files/folders into the right panel.
- **Download**: Select files or folders using checkboxes and click the download button.
- **Delete**: Select files or folders using checkboxes and click the delete button.

### Progress Tracking
Monitor upload and download progress in the "Tasks Progress" section at the bottom of the page.

## Browser Compatibility
- For the best experience, use the latest versions of Chrome or Edge.
- Older browsers may not support advanced features directory selection or maintaining folder hierarchy.

## Contributing
Contributions are welcome! Feel free to fork the repository and submit pull requests.

### Steps to Contribute
1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Commit your changes and push them to your fork.
4. Submit a pull request with a detailed description of your changes.

## License
This project is licensed under the MIT License. See the `LICENSE` file for details.

## Acknowledgments
- [Django](https://www.djangoproject.com/) for the web framework.
- [Boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html) for interacting with S3-compatible storage.
- [sslserver](https://github.com/teddziuba/django-sslserver) for local HTTPS development.

---

For any questions or issues, feel free to open an issue in the repository.