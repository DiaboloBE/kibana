/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { buildCasesPermissions, renderWithTestingProviders } from '../../common/mock';
import { basicCaseId, basicFileMock } from '../../containers/mock';
import { useDeleteFileAttachment } from '../../containers/use_delete_file_attachment';
import { FileDeleteButton } from './file_delete_button';

jest.mock('../../containers/use_delete_file_attachment');

const useDeleteFileAttachmentMock = useDeleteFileAttachment as jest.Mock;

describe('FileDeleteButton', () => {
  const mutate = jest.fn();

  useDeleteFileAttachmentMock.mockReturnValue({ isLoading: false, mutate });

  describe('isIcon', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders delete button correctly', async () => {
      renderWithTestingProviders(
        <FileDeleteButton caseId={basicCaseId} fileId={basicFileMock.id} isIcon={true} />
      );

      expect(await screen.findByTestId('cases-files-delete-button')).toBeInTheDocument();
    });

    it('clicking delete button opens the confirmation modal', async () => {
      renderWithTestingProviders(
        <FileDeleteButton caseId={basicCaseId} fileId={basicFileMock.id} isIcon={true} />
      );

      const deleteButton = await screen.findByTestId('cases-files-delete-button');

      expect(deleteButton).toBeInTheDocument();

      await userEvent.click(deleteButton);

      expect(await screen.findByTestId('property-actions-confirm-modal')).toBeInTheDocument();
    });

    it('clicking delete button in the confirmation modal calls deleteFileAttachment with proper params', async () => {
      renderWithTestingProviders(
        <FileDeleteButton caseId={basicCaseId} fileId={basicFileMock.id} isIcon={true} />
      );

      const deleteButton = await screen.findByTestId('cases-files-delete-button');

      expect(deleteButton).toBeInTheDocument();

      await userEvent.click(deleteButton);

      expect(await screen.findByTestId('property-actions-confirm-modal')).toBeInTheDocument();

      await userEvent.click(await screen.findByTestId('confirmModalConfirmButton'));

      await waitFor(() => {
        expect(mutate).toHaveBeenCalledTimes(1);
      });

      expect(mutate).toHaveBeenCalledWith({
        caseId: basicCaseId,
        fileId: basicFileMock.id,
      });
    });

    it('delete button is not rendered if user has no delete permission', async () => {
      renderWithTestingProviders(
        <FileDeleteButton caseId={basicCaseId} fileId={basicFileMock.id} isIcon={true} />,
        {
          wrapperProps: {
            permissions: buildCasesPermissions({ delete: false }),
          },
        }
      );

      expect(screen.queryByTestId('cases-files-delete-button')).not.toBeInTheDocument();
    });
  });

  describe('not isIcon', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('renders delete button correctly', async () => {
      renderWithTestingProviders(
        <FileDeleteButton caseId={basicCaseId} fileId={basicFileMock.id} />
      );

      expect(await screen.findByTestId('cases-files-delete-button')).toBeInTheDocument();

      expect(useDeleteFileAttachmentMock).toBeCalledTimes(1);
    });

    it('clicking delete button opens the confirmation modal', async () => {
      renderWithTestingProviders(
        <FileDeleteButton caseId={basicCaseId} fileId={basicFileMock.id} />
      );

      const deleteButton = await screen.findByTestId('cases-files-delete-button');

      expect(deleteButton).toBeInTheDocument();

      await userEvent.click(deleteButton);

      expect(await screen.findByTestId('property-actions-confirm-modal')).toBeInTheDocument();
    });

    it('clicking delete button in the confirmation modal calls deleteFileAttachment with proper params', async () => {
      renderWithTestingProviders(
        <FileDeleteButton caseId={basicCaseId} fileId={basicFileMock.id} />
      );

      const deleteButton = await screen.findByTestId('cases-files-delete-button');

      expect(deleteButton).toBeInTheDocument();

      await userEvent.click(deleteButton);

      expect(await screen.findByTestId('property-actions-confirm-modal')).toBeInTheDocument();

      await userEvent.click(await screen.findByTestId('confirmModalConfirmButton'));

      await waitFor(() => {
        expect(mutate).toHaveBeenCalledTimes(1);
      });

      expect(mutate).toHaveBeenCalledWith({
        caseId: basicCaseId,
        fileId: basicFileMock.id,
      });
    });

    it('delete button is not rendered if user has no delete permission', async () => {
      renderWithTestingProviders(
        <FileDeleteButton caseId={basicCaseId} fileId={basicFileMock.id} />,
        {
          wrapperProps: {
            permissions: buildCasesPermissions({ delete: false }),
          },
        }
      );

      expect(screen.queryByTestId('cases-files-delete-button')).not.toBeInTheDocument();
    });
  });
});
