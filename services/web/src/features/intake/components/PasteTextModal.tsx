import { Dialog, Transition } from '@headlessui/react';
import { X, FileText } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Button } from '@/components/ui';

interface PasteTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
  isSubmitting?: boolean;
}

export function PasteTextModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: PasteTextModalProps) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (text.trim().length > 0) {
      onSubmit(text.trim());
      setText('');
    }
  };

  const handleClose = () => {
    setText('');
    onClose();
  };

  const charCount = text.length;
  const minChars = 50;
  const isValid = charCount >= minChars;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-xl bg-white p-6 shadow-xl transition-all dark:bg-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary-100 p-2 dark:bg-primary-900">
                      <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                      Paste Requirements
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                  Paste your requirement text below. It will be processed and
                  decomposed into features.
                </p>

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your requirement text here...

Example:
The system shall allow users to upload requirement documents in PDF, DOCX, TXT, or MD format. The maximum file size should be 10MB. Users should see upload progress and receive confirmation when the upload is complete."
                  className="w-full h-64 rounded-lg border border-gray-300 p-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-primary-400 dark:focus:ring-primary-800"
                  disabled={isSubmitting}
                />

                <div className="mt-2 flex items-center justify-between text-sm">
                  <span
                    className={
                      charCount < minChars
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }
                  >
                    {charCount} characters
                    {charCount < minChars && ` (minimum ${minChars})`}
                  </span>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={!isValid || isSubmitting}
                    loading={isSubmitting}
                  >
                    Submit Requirements
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
