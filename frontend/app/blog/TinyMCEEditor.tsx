'use client';

import { Editor } from '@tinymce/tinymce-react';
import { useRef } from 'react';
import type { Editor as TinyMCEEditorType } from 'tinymce';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function TinyMCEEditor({ value, onChange }: Props) {
  const editorRef = useRef<TinyMCEEditorType | null>(null);

  return (
    <Editor
      apiKey="your-tinymce-api-key" // Replace or remove if self-hosted
      onInit={(_, editor) => {
        editorRef.current = editor;
      }}
      value={value}
      onEditorChange={(newValue) => onChange(newValue)}
      init={{
        height: 400,
        menubar: false,
        plugins: [
          'advlist autolink lists link image charmap preview anchor',
          'searchreplace visualblocks code fullscreen',
          'insertdatetime media table paste help wordcount',
        ],
        toolbar:
          'undo redo | formatselect | bold italic underline | ' +
          'alignleft aligncenter alignright alignjustify | ' +
          'bullist numlist outdent indent | removeformat | help',
        content_style:
          'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
      }}
    />
  );
}
