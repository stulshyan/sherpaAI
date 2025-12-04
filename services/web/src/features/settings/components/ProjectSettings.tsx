import { Check, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import type { ProjectSettingsData } from '../types';
import { SettingsSection } from './SettingsSection';

interface ProjectSettingsProps {
  project: ProjectSettingsData;
  onUpdateDescription: (description: string) => void;
  isUpdating?: boolean;
  className?: string;
}

export function ProjectSettings({
  project,
  onUpdateDescription,
  isUpdating = false,
  className,
}: ProjectSettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState(project.description);

  const handleSave = () => {
    onUpdateDescription(editedDescription);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedDescription(project.description);
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <SettingsSection title="Project" className={className}>
      <div className="space-y-4">
        {/* Project Name */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <span className="text-sm font-medium text-gray-500">Project Name</span>
          <span className="text-sm text-gray-900">{project.name}</span>
        </div>

        {/* Project ID */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <span className="text-sm font-medium text-gray-500">Project ID</span>
          <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">{project.id}</code>
        </div>

        {/* Description */}
        <div className="border-b border-gray-100 pb-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Description</span>
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                leftIcon={<Pencil className="h-3 w-3" />}
              >
                Edit
              </Button>
            )}
          </div>
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                rows={3}
                placeholder="Enter project description..."
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isUpdating}
                  leftIcon={<X className="h-3 w-3" />}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={isUpdating}
                  leftIcon={<Check className="h-3 w-3" />}
                >
                  {isUpdating ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-900">{project.description || 'No description'}</p>
          )}
        </div>

        {/* Created Date */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <span className="text-sm font-medium text-gray-500">Created</span>
          <span className="text-sm text-gray-900">{formatDate(project.createdAt)}</span>
        </div>

        {/* Owner */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Owner</span>
          <span className="text-sm text-gray-900">
            {project.owner.name} <span className="text-gray-500">({project.owner.email})</span>
          </span>
        </div>
      </div>
    </SettingsSection>
  );
}
