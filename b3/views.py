import os
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.http import HttpResponse
import json
from .s3 import *
from pathlib import Path
import pytz

from .models import Bucket

# Create your views here.


key_pair = (os.getenv('S3_KEY'), os.getenv('S3_SECRET'))
service_region = os.getenv('S3_REGION')
service_provider = os.getenv('S3_PROVIDER')
s3 = S3(key_pair, service_provider, service_region)

def build_dir_tree(bucket_name, dir_name=''):
    html_str = ''
    dir_list, _ = s3.get_object_list(bucket_name, dir_name, '/')
    if dir_list:
        html_str += f'<ul class="dir_children">'
        for sub_dir in dir_list:
            html_str += (f'<li><button onclick="onCaret(this, \'{bucket_name}\', \'{sub_dir}\')"  '
                         f'class="caret" id="caret_{sub_dir}"></button>'
                         f'<button onclick="onFolder(\'{bucket_name}\', \'{sub_dir}\')"'
                         f' class="dir_node" id="{bucket_name}_{sub_dir}">{Path(sub_dir).name}</button></li>\n')
        html_str += f'</ul>'
    return html_str

def convert_to_user_timezone(date_str, timezone):
    tz = pytz.timezone(timezone)
    dt_userzone = date_str.replace(tzinfo=pytz.utc).astimezone(tz)
    return dt_userzone.strftime('%Y-%m-%d %H:%M:%S')


def build_dir_contents(bucket_name, dir_name='', timezone=''):
    html_str = ''
    folders, files = s3.get_object_list(bucket_name, dir_name, '/')
    html_str += '<table id="file_table">'

    html_str += '<tr>'
    html_str += '<th>Name</th>'
    html_str += '<th>Size</th>'
    html_str += '<th>LastModified</th>'
    html_str += '</tr>'

    if dir_name != '':
        prev_folder = Path(dir_name).parent.as_posix() + '/'
        prev_folder = '' if prev_folder == './' else prev_folder

        html_str += '<tr>'
        html_str += (f'<td><span class="folder_list" onclick="onFolder(\'{bucket_name}\', \'{prev_folder}\')">'
                     f'..</span></td>')
        html_str += f'<td></td>'
        html_str += f'<td></td>'
        html_str += '</tr>'

    for folder in folders:
        html_str += '<tr>'
        html_str += (f'<td class="td_folder" id="{bucket_name}/{folder}"><input type="checkbox" /><span class="folder_list" onclick="onFolder(\'{bucket_name}\', \'{folder}\')">'
                     f'{Path(folder).name}</span></td>')
        html_str += f'<td></td>'
        html_str += f'<td></td>'
        html_str += '</tr>'


    for file in files:
        html_str += '<tr>'
        html_str += f'<td class="td_file" id="{bucket_name}/{file["name"]}"><input type="checkbox"/><span class="file_list">{Path(file["name"]).name}<span></td>'
        html_str += f'<td>{file["size"]}</td>'
        html_str += f'<td>{convert_to_user_timezone(file["date"], timezone)}</td>'
        html_str += '</tr>'

    html_str += '</table>'

    return html_str

@login_required(login_url='/')
def index(request):


    buckets = [bucket.name for bucket in Bucket.objects.all()]


    html_tag = f'<ul>'
    for bucket_name in buckets:
        html_tag += (f'<li>'
                     f'<button onclick="onCaret(this, \'{bucket_name}\', \'\')" '
                     f'class="caret"></button>'
                     f'<button onclick="onFolder(\'{bucket_name}\', \'\')"'
                     f' class="bucket" id="{bucket_name}_"> {bucket_name}</button>'
                     f'</li>')

    html_tag += '</ul>'
    context = {
        'folder_list': html_tag,
        'file_list': f'<table><tr><th>Name</th><th>Size</th><th>LastModified</th></tr></table>',
        'current_address': '',
    }
    return render(request, 'b3/index.html', context)

@login_required(login_url='/')
def expandDir(request):

    if request.method == 'POST':
        post_data = json.loads(request.body.decode('utf-8'))
        dir_path = post_data.get('dir_path')
        bucket_name = post_data.get('bucket_name')
        html_str = build_dir_tree(bucket_name, dir_path)
        return HttpResponse(json.dumps({'result': html_str}), content_type='application/json')
    else:
        return HttpResponse(json.dumps({'result': 'error'}), content_type='application/json')

@login_required(login_url='/')
def listDir(request):

    if request.method == 'POST':
        post_data = json.loads(request.body.decode('utf-8'))
        dir_path = post_data.get('dir_path')
        bucket_name = post_data.get('bucket_name')
        timezone = post_data.get('timezone')
        html_str = build_dir_contents(bucket_name, dir_path, timezone)
        return HttpResponse(json.dumps({'result': html_str}), content_type='application/json')
    else:
        return HttpResponse(json.dumps({'result': 'error'}), content_type='application/json')
    
@login_required(login_url='/')
def download(request):

    if request.method == 'POST':

        post_data = json.loads(request.body.decode('utf-8'))

        folder_list = json.loads(post_data.get('folder_list'))
        file_list = json.loads(post_data.get('file_list'))

        method = post_data.get('method')
        
        response = s3.get_signed_url(folder_list, file_list, method)

        #response = "testing"
   

        return HttpResponse(json.dumps({'result': response}), content_type='application/json')
    else:
        return HttpResponse(json.dumps({'result': 'error'}), content_type='application/json')

@login_required(login_url='/')    
def start_upload(request):
    if request.method == 'POST':
        post_data = json.loads(request.body.decode('utf-8'))
        file_list = json.loads(post_data.get('file_list'))
        chunk_size = post_data.get('chunk_size')

        response = s3.start_upload(file_list, chunk_size)

        return HttpResponse(json.dumps({'result': response}), content_type='application/json')
    else:
        return HttpResponse(json.dumps({'result': 'error'}), content_type='application/json')
    
@login_required(login_url='/')
def finish_upload(request):

    if request.method == 'POST':
        post_data = json.loads(request.body.decode('utf-8'))

        bucket = post_data.get('bucket')
        key = post_data.get('object_path')
        upload_id = post_data.get('upload_id')
        upload_parts = json.loads(post_data.get('parts'))



        s3.complete_upload(bucket, key, upload_id, upload_parts)

        return HttpResponse(json.dumps({'result': 'ok'}), content_type='application/json')
    else:
        return HttpResponse(json.dumps({'result': 'error'}), content_type='application/json')

@login_required(login_url='/')
def delete(request):

    if request.method == 'POST':

        post_data = json.loads(request.body.decode('utf-8'))

        operation = post_data.get('operation')

        if operation == 'prepare':
            folder_list = json.loads(post_data.get('folder_list'))
            file_list = json.loads(post_data.get('file_list'))
            response = s3.prepare_delete(folder_list, file_list)

        elif operation == 'initiate':
            delete_list = json.loads(post_data.get('delete_list'))
            print(delete_list)
            response = s3.initiate_delete(delete_list)


        return HttpResponse(json.dumps({'result': response}), content_type='application/json')
    else:
        return HttpResponse(json.dumps({'result': 'error'}), content_type='application/json')