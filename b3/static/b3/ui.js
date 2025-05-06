
import { upload, download, uploadDroppedItems, uploadSelectedFolder } from './transfer.js';
// import { download } from './transfer.js'; 
// import { uploadDroppedItems } from './transfer.js';

function resizePanels(){
    // Resize the left and right panels based on the window size and other elements
    // Calculate the total height of the top and bottom frames, and the address box

    var total_height = 10 + document.getElementById("top_frame").clientHeight;
    total_height += document.getElementById('bottom_frame').clientHeight;
    total_height += document.getElementById('address_box').clientHeight;
    total_height += 20; // Extra space for the scroll bar

    let new_height = window.innerHeight - total_height;
    document.getElementById('left_frame').style.height = new_height + "px";
    document.getElementById('right_frame').style.height = new_height + "px";

}

window.addEventListener('resize', function(event){
    resizePanels();
})


function dragElement(element, direction) {
    let md; // Mouse down data
    const left = document.getElementById("left_frame");
    const right = document.getElementById("right_frame");

    element.addEventListener("mousedown", onMouseDown);

    function onMouseDown(e) {
        e.preventDefault(); // Prevent text selection
        md = {
            e,
            offsetLeft: element.offsetLeft,
            leftWidth: left.offsetWidth,
            rightWidth: right.offsetWidth,
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }

    function onMouseMove(e) {
        const delta = {
            x: e.clientX - md.e.clientX,
        };

        if (direction === "H") {
            // Restrict movement within bounds
            delta.x = Math.min(Math.max(delta.x, -md.leftWidth), md.rightWidth);

            // Update element position and panel widths
            element.style.left = md.offsetLeft + delta.x + "px";
            left.style.width = md.leftWidth + delta.x + "px";
            right.style.width = md.rightWidth - delta.x + "px";
        }
    }

    function onMouseUp() {
        // Remove event listeners to stop dragging
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
    }
}


document.addEventListener('DOMContentLoaded', () => {

    const filesUpload = document.querySelector('#filesUpload');
    filesUpload.addEventListener('change', (event)=>{
        const files = [...event.target.files];
        upload(files);
        event.target.value = "";
    });

    const folderUpload = document.querySelector('#folderUpload');
    folderUpload.addEventListener('change', (event)=>{
        console.log(event.target.files);
        uploadSelectedFolder(event.target.files);
    });

    dragElement( document.getElementById("separator"), "H");
    resizePanels();

});

window.onCaret = async function (obj, bucket_name, dir_path){
    // Toggle the caret icon and expand/collapse the directory
    obj.classList.toggle("caret-right");
    obj.classList.toggle("caret-down");
    var qData = {
        'bucket_name':bucket_name,
        'dir_path': dir_path
    };
    var csrfToken = $('[name="csrfmiddlewaretoken"]').val();
    var ele_id = bucket_name + '_' + dir_path;


    if (document.getElementById(ele_id).nextSibling == null){

        try {
            const response = await fetch('/b3/expanddir/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify(qData),
            });

            if (response.ok) {
                const data = await response.json();
                document.getElementById(ele_id).insertAdjacentHTML("afterend", data.result);
            } else {
                console.error('Error expanding directory:', response.statusText);
                alert('Error expanding directory.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while expanding the directory.');
        }

    } else {
        document.getElementById(ele_id).nextSibling.classList.toggle("li_close");
    }
}



window.onFolder = async function (bucket_name, dir_path){
    // Fetch and display the contents of the selected folder
    
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    var qData = {
        'bucket_name':bucket_name,
        'dir_path': dir_path,
        'timezone': timeZone,
    };
    var csrfToken = $('[name="csrfmiddlewaretoken"]').val();

    document.getElementById('address_value').innerHTML= bucket_name + '/' + dir_path;

    try {
        const response = await fetch('/b3/listdir/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(qData),
        });

        if (response.ok) {
            const data = await response.json();
            document.getElementById('right_frame').innerHTML = "";
            document.getElementById('right_frame').insertAdjacentHTML("afterbegin", data.result);
        } else {
            console.error('Error fetching folder contents:', response.statusText);
            alert('Error fetching folder contents.');
        }
    } catch (error) {
        console.error('Error:', error);
        console.log("bucket_name: ", bucket_name, " dir_path: ", dir_path);
        alert('An error occurred while fetching folder contents.');
    }


}



window.onUpload = function (){
    var modal = document.getElementById("upload_options");
    modal.style.display = "block";
}

document.getElementById("upload_modal_close").onclick = function() {
    var modal = document.getElementById("upload_options");
    modal.style.display = "none";
}

window.onclick = function(event) {
    // Close the modal if the user clicks outside of it
    var modal = document.getElementById("upload_options");

    if (event.target == modal){
        document.getElementById("upload_options").style.display = "none";
    }
}

window.onFilesUpload = function (){
    document.getElementById("upload_options").style.display = "none";
    filesUpload.click();
}

window.onFolderUpload = function (){
    document.getElementById("upload_options").style.display = "none";
    folderUpload.click();
}

async function initiateDelete(delete_list, delete_path){
    const csrfToken = $('[name="csrfmiddlewaretoken"]').val();
    const bucket_name = delete_path.split('/')[0];

    const qData = {
        bucket: bucket_name,
        delete_list: JSON.stringify(delete_list),
        operation: 'initiate',
    };

    try {
        const response = await fetch('/b3/delete/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(qData),
        });

        if (response.ok) {
            const data = await response.json();
            
            if (delete_path === document.getElementById('address_value').textContent) {
                const path_parts = delete_path.split('/');
                const bucket_name = path_parts.shift();
                const folder_path = path_parts.length > 0 ? path_parts.join('/') : '';
                window.onFolder(bucket_name, folder_path); // Refresh folder view

                const ib = InfoBox.createAndShow('delete_info', 'Delete Operation',
                    `Delete operation completed successfully. <br><br> `);

            }
            
        } else {
            alert('Error performing delete operation.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while initializing the delete operation.');
    }  


}

async function prepareDelete(folder_list, file_list, delete_path){
    const csrfToken = $('[name="csrfmiddlewaretoken"]').val();
    const bucket_name = delete_path.split('/')[0];

    const qData = {
        bucket: bucket_name,
        folder_list: JSON.stringify(folder_list),
        file_list: JSON.stringify(file_list),
        operation: 'prepare',
    };

    try {
        const response = await fetch('/b3/delete/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(qData),
        });

        if (response.ok) {
            const data = await response.json();

            var tb_list = data.result.map((item) => {
                return `<tr><td>${item}</td></tr>`;
            }).join('');

            // Create a confirmation popup
            const popup = PopUp.createAndShow('delete_confirmation', 'Delete Confirmation', 
                `<b>Are you sure you want to delete the following items?</b> <br/><br/>`); 
            let dl = popup.modal.getElementsByClassName('popup-body')[0];
            dl.innerHTML += `
                <div style="text-align: left; overflow: auto; max-height: 200px; padding: 10px; border: 1px solid #ccc;">
                    <table>${tb_list}</table>
                </div>`;

            const okBtn = document.getElementById('delete_confirmation_ok');
            okBtn.innerText = "Delete";

            okBtn.onclick = () => {
                popup.remove(); 
                initiateDelete(data.result, delete_path); // Proceed with deletion

            };

            
        } else {
            alert('Servor error occurred while preparing for delete.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while initializing the delete operation.');
    }  



}

window.onDelete = async function (){
    // Trigger delete process
    const csrfToken = $('[name="csrfmiddlewaretoken"]').val();
    const ta = document.getElementById('file_table');
    const current_path = document.getElementById('address_value').textContent;
    
    if(!ta){
        alert("No files or folders selected to delete. Use checkboxes to select.")
        return;
    }
    // Gather selected folders and files
    const folder_list = Array.from(ta.getElementsByClassName('td_folder'))
        .filter(td_folder => $(td_folder.getElementsByTagName('input')[0]).is(':checked'))
        .map(td_folder => td_folder.id);

    const file_list = Array.from(ta.getElementsByClassName('td_file'))
        .filter(td_file => $(td_file.getElementsByTagName('input')[0]).is(':checked'))
        .map(td_file => td_file.id);

    
    if (folder_list.length === 0 && file_list.length === 0){
        alert("No files or folders selected to delete. Use checkboxes to select.")
        return;
    }

    await prepareDelete(folder_list, file_list, current_path);

}

// Trigger download process
window.onDownload = async function () {
    const csrfToken = $('[name="csrfmiddlewaretoken"]').val();
    const ta = document.getElementById('file_table');

    if(!ta){
        alert("No files or folders selected to download. Use checkboxes to select.");
        return;
    }

    // Gather selected folders and files
    const folder_list = Array.from(ta.getElementsByClassName('td_folder'))
        .filter(td_folder => $(td_folder.getElementsByTagName('input')[0]).is(':checked'))
        .map(td_folder => td_folder.id);

    const file_list = Array.from(ta.getElementsByClassName('td_file'))
        .filter(td_file => $(td_file.getElementsByTagName('input')[0]).is(':checked'))
        .map(td_file => td_file.id);

    const current_path = document.getElementById('address_value').textContent;
    const bucket_name = current_path.split('/')[0];

    const qData = {
        bucket: bucket_name,
        folder_list: JSON.stringify(folder_list),
        file_list: JSON.stringify(file_list),
        method: 'get_object',
    };

    try {
        const response = await fetch('/b3/download/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(qData),
        });

        if (response.ok) {
            const data = await response.json();
            await download(data.result);
        } else {
            alert('Error initializing downloads.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while initializing the downloads.');
    }
};


document.addEventListener("dragover", (ev) => {
    
    ev.preventDefault();

    if (ev.target.id === 'right_frame'){
        ev.target.classList.add('drop_to_right_frame');
        document.getElementById('address_value').classList.add('blink_me')
    } else if (ev.target.classList.contains('td_folder')){
        ev.target.classList.add('drop_to_folder');
    } else if (ev.target.parentElement && ev.target.parentElement.classList.contains('td_folder')) {
        ev.target.parentElement.classList.add('drop_to_folder');
    } else {
        ev.dataTransfer.dropEffect = "none";
        var tgt = ev.target.parentElement;
        while (tgt){
            if (tgt.id === 'right_frame'){
                ev.dataTransfer.dropEffect = "copy";
                tgt.classList.add('drop_to_right_frame');
                document.getElementById('address_value').classList.add('blink_me')
                break;
            } else {
                tgt = tgt.parentElement;
            }
        }
        
    }

});

document.addEventListener("dragleave", (ev) => {
    ev.preventDefault();

    if (ev.target.id === 'right_frame'){
        ev.target.classList.remove('drop_to_right_frame');
        document.getElementById('address_value').classList.remove('blink_me')
    } else if (ev.target.classList.contains('td_folder')){
        ev.target.classList.remove('drop_to_folder');
    } else if (ev.target.parentElement && ev.target.parentElement.classList.contains('td_folder')) {
        ev.target.parentElement.classList.remove('drop_to_folder');
    } else {
        ev.dataTransfer.dropEffect = "none";
        var tgt = ev.target.parentElement;
        while (tgt){
            if (tgt.id === 'right_frame'){
                ev.dataTransfer.dropEffect = "copy";
                tgt.classList.remove('drop_to_right_frame');
                document.getElementById('address_value').classList.remove('blink_me')
                break;
            } else {
                tgt = tgt.parentElement;
            }
        }
        
    }


});

document.addEventListener("drop", (ev) => {
    ev.preventDefault();

    var tgt_loc = null;

    if (ev.target.id === 'right_frame'){
        ev.target.classList.remove('drop_to_right_frame');
        document.getElementById('address_value').classList.remove('blink_me')
        tgt_loc = document.getElementById('address_value').textContent;
    } else if (ev.target.classList.contains('td_folder')){
        ev.target.classList.remove('drop_to_folder');
        tgt_loc = ev.target.id;
    } else if (ev.target.parentElement && ev.target.parentElement.classList.contains('td_folder')) {
        ev.target.parentElement.classList.remove('drop_to_folder');
        tgt_loc = ev.target.parentElement.id;
    } else {
        ev.dataTransfer.dropEffect = "none";
        var tgt = ev.target.parentElement;
        while (tgt){
            if (tgt.id === 'right_frame'){
                ev.dataTransfer.dropEffect = "copy";
                tgt.classList.remove('drop_to_right_frame');
                document.getElementById('address_value').classList.remove('blink_me')
                tgt_loc = document.getElementById('address_value').textContent;
                break;
            } else {
                tgt = tgt.parentElement;
            }
        }
        
    }
    

    if (tgt_loc){
        console.log(ev.dataTransfer.items);
        uploadDroppedItems(ev.dataTransfer.items);
    }

});

class PopUp {
    constructor(id, title, content) {
        this.id = id;
        this.title = title;
        this.content = content;
        this.modal = null;
    }
    static createAndShow(id, title, content) {
        const popup = new PopUp(id, title, content);
        popup.createModal();
        return popup;
    }
    createModal() {
        this.modal = document.createElement('div');
        this.modal.id = this.id;
        this.modal.className = 'popup';
        this.modal.innerHTML = `
            <div class="popup-content">
                <div class="popup-header">
                    <span class="popup-title">${this.title}</span>
                    <span class="popup-close" id="${this.id}_close">&times;</span>
                </div>
                <div class="popup-body">${this.content}</div>
                <div class="popup-footer">
                    <button id="${this.id}_ok" class="popup-button">OK</button>
                    <button id="${this.id}_cancel" class="popup-button">Cancel</button>
                </div>
            </div>
        `;
        this.modal.style.display = 'flex';

        document.body.appendChild(this.modal);

        this.addEventListeners(); // Add event listeners after appending the modal


    }

    addEventListeners() {
        const closeBtn = document.getElementById(`${this.id}_close`);
        const okBtn = document.getElementById(`${this.id}_ok`);
        const cancelBtn = document.getElementById(`${this.id}_cancel`);

        closeBtn.onclick = () => this.remove();
        okBtn.onclick = () => this.remove();
        cancelBtn.onclick = () => this.remove();
    }
    show() {
        this.modal.style.display = 'flex';
    }
    remove() {
        this.modal.style.display = 'none';
        document.body.removeChild(this.modal);
    }
}

class InfoBox extends PopUp {
    constructor(id, title, content) {
        super(id, title, content);
    }
    static createAndShow(id, title, content) {
        const infoBox = new InfoBox(id, title, content);
        infoBox.createModal(); // Call InfoBox's createModal
        infoBox.show(); // Show the modal
        return infoBox;
    }
    createModal() {
        super.createModal();

        // Properly select and hide the cancel button
        const cancelBtn = this.modal.querySelector(`#${this.id}_cancel`);
        if (cancelBtn) {
            cancelBtn.style.display = 'none'; // Hide the cancel button
        }

        console.log("Created InfoBox modal:");
    }

}

export { PopUp, InfoBox };