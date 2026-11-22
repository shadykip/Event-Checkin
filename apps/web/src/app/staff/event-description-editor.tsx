"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { JSONContent } from "@tiptap/react";

export const descriptionStyles =
    "break-words text-sm leading-7 text-slate-700 " +
    "[&_p+p]:mt-3 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold " +
    "[&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold " +
    "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 " +
    "[&_strong]:font-bold [&_em]:italic";

function plainDocument(text: string): JSONContent {
    return {
        type: "doc",
        content: text.split(/\r?\n/).map((line) => ({
            type: "paragraph",
            content: line ? [{ type: "text", text: line }] : [],
        })),
    };
}

type Props = {
    initialHtml?: string | null;
    initialText?: string | null;
    onChange: (html: string) => void;
    disabled: boolean;
};

export default function EventDescriptionEditor({
    initialHtml,
    initialText,
    onChange,
    disabled,
}: Props) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3] },
                blockquote: false,
                code: false,
                codeBlock: false,
                horizontalRule: false,
                link: false,
                strike: false,
                underline: false,
            }),
        ],
        content: initialHtml || plainDocument(initialText ?? ""),
        editorProps: {
            attributes: {
                role: "textbox",
                "aria-label": "Event description",
                "aria-multiline": "true",
                class: `min-h-40 px-4 py-3 outline-none ${descriptionStyles}`,
            },
        },
        onUpdate: ({ editor: current }) => {
            onChange(current.isEmpty ? "" : current.getHTML());
        },
    });

    const active = useEditorState({
        editor,
        selector: ({ editor: current }) => ({
            bold: current?.isActive("bold") ?? false,
            italic: current?.isActive("italic") ?? false,
            heading: current?.isActive("heading", { level: 2 }) ?? false,
            bullets: current?.isActive("bulletList") ?? false,
            numbered: current?.isActive("orderedList") ?? false,
        }),
    });

    const controls = [
        {
            label: "Bold",
            active: active?.bold,
            run: () => editor?.chain().focus().toggleBold().run(),
        },
        {
            label: "Italic",
            active: active?.italic,
            run: () => editor?.chain().focus().toggleItalic().run(),
        },
        {
            label: "Heading",
            active: active?.heading,
            run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
            label: "Bullets",
            active: active?.bullets,
            run: () => editor?.chain().focus().toggleBulletList().run(),
        },
        {
            label: "Numbered list",
            active: active?.numbered,
            run: () => editor?.chain().focus().toggleOrderedList().run(),
        },
    ];

    return (
        <div
            inert={disabled}
            className="overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-700/20"
        >
            <div
                role="group"
                aria-label="Description formatting"
                className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2"
            >
                {controls.map((control) => (
                    <button
                        key={control.label}
                        type="button"
                        disabled={disabled || !editor}
                        aria-pressed={Boolean(control.active)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={control.run}
                        className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${control.active
                            ? "bg-teal-100 text-teal-900"
                            : "text-slate-700 hover:bg-slate-200"
                            }`}
                    >
                        {control.label}
                    </button>
                ))}
            </div>

            <EditorContent editor={editor} />
        </div>
    );
}