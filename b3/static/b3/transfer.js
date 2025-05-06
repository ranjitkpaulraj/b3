// This file contains functions for uploading and downloading files using the File System Access API and Fetch API.
// It includes functions for handling drag-and-drop file uploads, uploading files in chunks, and downloading files to a specified directory.

import { PopUp, InfoBox } from "./ui.js";

const upload_chunk_size = 8 * 1024 * 1024; // 8 MB chunks
const MAX_RETRIES = 3; // Maximum number of retries for failed chunks
const BASE_DELAY = 1000; // Base delay in milliseconds for exponential backoff


async function upload_all(result, files, upload_path, csrfToken) {
    
    const path_parts = upload_path.split('/');
    const bucket_name = path_parts.shift();
    const folder_path = path_parts.length > 0 ? path_parts.join('/') : '';

    const promises = result.map((uploadDetails, index) =>
        upload_single_file(uploadDetails, files[index], bucket_name, folder_path, csrfToken)
    );

    // Wait for all uploads to complete
    await Promise.all(promises);

}

async function upload_single_file(uploadDetails, file, bucket_name, folder_path, csrfToken) {
    const uploaded_parts = [];
    const failed_chunks = [];
    const total_chunks = Math.ceil(file.size / upload_chunk_size);
    const progress_bar = create_progress_bar(`Uploading ${file.name}: `, file.size);

    const MAX_CONCURRENT_UPLOADS = 5; // Limit the number of concurrent uploads
    const uploadPromises = [];

    // Manage upload chunks in parallel
    for (let chunk_index = 0; chunk_index < total_chunks; chunk_index++) {
        const chunk_start = chunk_index * upload_chunk_size;
        const chunk_end = Math.min(chunk_start + upload_chunk_size, file.size);
        const file_chunk = file.slice(chunk_start, chunk_end);

        const uploadPromise = (async () => {
            try {
                const etag = await upload_chunk_with_retry(uploadDetails.token[chunk_index], file_chunk);
                uploaded_parts.push({ PartNumber: chunk_index + 1, ETag: etag });

                // Update progress bar
                progress_bar.value += file_chunk.size;
            } catch (error) {
                console.error(`Failed to upload chunk ${chunk_index + 1}:`, error);
                failed_chunks.push(chunk_index); // Store failed chunk index

                //throw error; // Abort if any chunk fails
            }
        })();

        uploadPromises.push(uploadPromise);

        // Wait for uploads if concurrency limit is reached
        if (uploadPromises.length >= MAX_CONCURRENT_UPLOADS) {
            await Promise.race(uploadPromises);
        }
    }

    await Promise.all(uploadPromises); // Wait for all remaining uploads to complete

    for (const chunk_index of failed_chunks) {
        const chunk_start = chunk_index * upload_chunk_size;
        const chunk_end = Math.min(chunk_start + upload_chunk_size, file.size);
        const file_chunk = file.slice(chunk_start, chunk_end);
        try {
            const etag = await upload_chunk_with_retry(uploadDetails.token[chunk_index], file_chunk);
            uploaded_parts.push({ PartNumber: chunk_index + 1, ETag: etag });
            // Update progress bar
            progress_bar.value += file_chunk.size;
        } catch (error) {
            console.error(`Failed to upload chunk ${chunk_index + 1} after retries:`, error);
            alert(`Failed to upload chunk ${chunk_index + 1} after retries. Please try again.`);
            return; // Abort if any chunk fails after retries
        }
    }
    

    // Sort uploaded_parts array in ascending order of PartNumber
    uploaded_parts.sort((a, b) => a.PartNumber - b.PartNumber);


    // Remove progress bar when upload is complete
    progress_bar.parentElement.remove();

    // Finalize the multipart upload
    const qData = {
        bucket: bucket_name,
        object_path: [folder_path, file.name].join(''),
        upload_id: uploadDetails.upload_id,
        parts: JSON.stringify(uploaded_parts),
    };

    try {
        await finalize_upload(qData, csrfToken, file.name, bucket_name, folder_path);
    } catch (error) {
        console.error("Error finalizing upload:", error);
        alert("Error finalizing upload");
    }
}

async function upload_chunk_with_retry(url, file_chunk, retries = MAX_RETRIES) {
    for (let attempt = 0; attempt < retries; attempt++) {
        const response = await fetch(url, {
            method: 'PUT',
            body: file_chunk,
        });

        if (response.ok) {
            return response.headers.get('ETag');
        } else if (attempt < retries - 1) {
            const delay = BASE_DELAY * Math.pow(2, attempt); // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
            console.warn(`Retrying chunk upload (${attempt + 1}/${retries})`);
        } else {
            throw new Error(`Failed to upload chunk after ${retries} attempts`);
        }
    }
}

async function finalize_upload(qData, csrfToken, file_name, bucket_name, folder_path) {
    const response = await fetch('/b3/finishupload/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify(qData),
    });

    if (response.ok) {

        const current_path = document.getElementById('address_value').textContent;
        if (current_path === `${bucket_name}/${folder_path}`) {
            window.onFolder(bucket_name, folder_path); // Refresh folder view
        }
    } else {
        throw new Error(`Failed to finalize upload for file: ${file_name}`);
    }
}

async function upload(files) {
    const csrfToken = $('[name="csrfmiddlewaretoken"]').val();
    const upload_path = document.getElementById('address_value').textContent;
    const file_array = Array.isArray(files) ? files : Array.from(files)
    const file_list = file_array.map(file => [upload_path + file.name, file.size]);
    const bucket_name = upload_path.split('/')[0];

    const qData = {
        bucket: bucket_name,
        file_list: JSON.stringify(file_list),
        chunk_size: upload_chunk_size,
    };

    try {
        const response = await fetch('/b3/startupload/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(qData),
        });

        if (response.ok) {
            const data = await response.json();
            upload_all(data.result, files, upload_path, csrfToken);
        } else {
            console.error('Failed to get upload details', response.statusText);
            alert('An error occurred while initializing the upload.');
        }
    } catch (error) {
        console.error('Error during upload initialization:', error);
        alert('An error occurred while initializing the upload. Please try again.');
    }
}

async function fallback_download(url_list) {
    for (const url of url_list) {
        await new Promise((resolve) => {

            const a = document.createElement('a');
            a.href = url.token;
            a.download = url.path.replace(/\//g, "#"); // Use the path as the filename, replacing slashes with hashes
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            resolve();
        });

        // Introduce a small delay between downloads to avoid overwhelming the browser
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
}

// Handle download of all files with concurrency
async function download(url_list) {

    if (!('showDirectoryPicker' in window)) {

        const popup = PopUp.createAndShow('download_compatibility', 'Browser Compatibility',
            "Your browser lacks modern features! Please use the latest versions of Chrome or Edge.\
            <br/><br/>While you may continue downloading files with your current browser, \
            <br/>the folder structure will be flattened, and all files will be downloaded to your browser's \
            <br/>default download location—typically the 'Downloads' folder.\
            <br/><br/>In cases where two folders contain files with identical names, \
            <br/>it may become challenging to distinguish between them.\
            <br/><br/>For an optimal experience, consider using the latest versions of Chrome or Edge. \
            <br/>These browsers preserve the original folder hierarchy and allow you to choose your preferred download location.\
            ");


        const okBtn = document.getElementById('download_compatibility_ok');
        const cancelBtn = document.getElementById('download_compatibility_cancel');
        okBtn.innerText = "Continue Downloading";
        cancelBtn.innerText = "Cancel Downloading";

        okBtn.onclick = () => {
            popup.remove();
            fallback_download(url_list)
            .then(() => {
                const ib = InfoBox.createAndShow('download_info', 'Download Operation',
                    `Download completed! <br><br> `);
            })
            .catch(error => console.error('Error during downloads:', error));
        };

        cancelBtn.onclick = () => {
            popup.remove();
        };


        return;
    }



    let root_dir_handle;
    try {
        root_dir_handle = await window.showDirectoryPicker();
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('User aborted directory selection.');
            alert('Directory selection was canceled.');
        } else {
            console.error('Error selecting directory:', error);
            alert('An error occurred while selecting the directory.');
        }
        return; // Exit the function if the directory selection is aborted or fails
    }

    const MAX_CONCURRENT_DOWNLOADS = 5; // Limit concurrent downloads
    const downloadQueue = [];

    for (const url of url_list) {
        if (downloadQueue.length >= MAX_CONCURRENT_DOWNLOADS) {
            await Promise.race(downloadQueue); // Wait for one download to complete
        }

        const downloadPromise = download_single_file(url, root_dir_handle);
        downloadQueue.push(downloadPromise);

        downloadPromise.finally(() => {
            downloadQueue.splice(downloadQueue.indexOf(downloadPromise), 1);
        });
    }

    await Promise.all(downloadQueue);

}

// Download a single file
async function download_single_file(url, root_dir_handle) {
    const url_parts = url.path.split('/');
    const file_name = url_parts.pop();
    let current_handle = root_dir_handle;

    for (const part of url_parts) {
        current_handle = await current_handle.getDirectoryHandle(part, { create: true });
    }

    const fileHandle = await current_handle.getFileHandle(file_name, { create: true });
    await download_url(url.token, fileHandle, url.path);
}

// Use fetch and stream data directly to a file
async function download_url(url, fileHandle, fileName, batchSize = 8 * 1024 * 1024) { // Default batch size: 8 MB
    try {
        const response = await fetch(url);

        if (!response.body) {
            alert('Your browser does not support streaming downloads. Please update to a modern browser.');
            throw new Error('ReadableStream is not supported in this browser.');
        }

        const writable = await fileHandle.createWritable();
        const reader = response.body.getReader();

        const totalBytes = response.headers.get('Content-Length') ? parseInt(response.headers.get('Content-Length'), 10) : null;
        let bytesReceived = 0;

        const progress_bar = create_progress_bar(`Downloading ${fileName} : `, totalBytes);

        // Buffer for batch writing
        const buffer = [];
        let bufferSize = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer.push(value);
            bufferSize += value.length;

            // Write to file when buffer reaches the batch size
            if (bufferSize >= batchSize) {
                await writable.write(new Blob(buffer)); // Write buffer as a Blob
                buffer.length = 0; // Clear buffer
                bufferSize = 0; // Reset buffer size
            }

            bytesReceived += value.length;

            // Update progress bar
            if (totalBytes) {
                progress_bar.value = bytesReceived;
            }
        }

        // Write any remaining data in the buffer
        if (bufferSize > 0) {
            await writable.write(new Blob(buffer)); // Write remaining data
        }

        await writable.close();
        progress_bar.parentElement.remove();

    } catch (error) {
        console.error(`Error downloading ${fileName}:`, error);
        alert(`Failed to download ${fileName}. Please try again.`);
    }
}

function create_progress_bar(msg, total_bytes){
    const div_ele = document.createElement('div');
    div_ele.innerText = msg;
    const progressBar = document.createElement('progress');
    progressBar.value = 0;
    progressBar.max = typeof total_bytes === 'number' && total_bytes > 0 ? total_bytes : 100;
    progressBar.setAttribute('aria-label', msg);


    const ele = document.getElementById('progress_list')
    ele.appendChild(div_ele);
    div_ele.appendChild(progressBar);

    return progressBar;

}

async function uploadSelectedFolder(folder){
    let file_list = [];

    for (let i = 0; i < folder.length; i++){
        let entry = folder[i]
        const file_name = entry.webkitRelativePath.length > 0 ? entry.webkitRelativePath : entry.name;
        const file = new File([entry], file_name, {
            type: entry.type,
            lastModified: entry.lastModified,
        });
        file_list.push(file);
    }
    
    upload(file_list);
            
  
}

async function uploadDroppedItems(drop_items){

    let file_list = [];
    let wk_entry_list = [];

    console.log(drop_items);

    for (let i = 0; i < drop_items.length; i++){
        wk_entry_list.push(drop_items[i].webkitGetAsEntry());
    }

    while (wk_entry_list.length > 0){
        let entry = wk_entry_list.shift();
        if (entry.isFile){
            const f = await getFileFromEntry(entry)

            file_list.push(f);
        } else if (entry.isDirectory){
            wk_entry_list.push(... await readDirEntries(entry.createReader()));
        }
    }

    upload(file_list);
    

}

async function getFileFromEntry(fileEntry) {
    return new Promise((resolve, reject) => {
        fileEntry.file((file) => {
            const fileName = fileEntry.fullPath ? fileEntry.fullPath.substring(1) : file.name;

            const fileObject = new File([file], fileName, {
                type: file.type,
                lastModified: file.lastModified,
            });
            resolve(fileObject);
        }, reject);
    });
}


async function readDirEntries(dirReader){
    let entries = [];
    let readEntries = await readEntriesPromise(dirReader);
    while (readEntries.length > 0){
        entries.push(...readEntries);
        readEntries = await readEntriesPromise(dirReader);
    }
    return entries;
}

async function readEntriesPromise(dirReader){
    try {
        return await new Promise((resolve, reject) => {
            dirReader.readEntries(resolve, reject);
        });
    } catch (err){
        console.log(err);
    }
}

export  {
    uploadDroppedItems,
    download,
    upload,
    uploadSelectedFolder
};
