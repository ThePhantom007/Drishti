function varargout = ioHelpers(action, varargin)
%IOHELPERS Small collection of shared I/O utilities for the pipeline.
%   img = ioHelpers('readImage', path)
%   ioHelpers('ensureDir', dirPath)
%   jsonStr = ioHelpers('toJSON', structVar)

    switch action
        case 'readImage'
            path = varargin{1};
            if ~isfile(path)
                error('ioHelpers:fileNotFound', 'Image not found: %s', path);
            end
            varargout{1} = imread(path);

        case 'ensureDir'
            dirPath = varargin{1};
            if ~isfolder(dirPath)
                mkdir(dirPath);
            end

        case 'toJSON'
            varargout{1} = jsonencode(varargin{1}, 'PrettyPrint', true);

        case 'timestampId'
            varargout{1} = char(datetime('now', 'Format', 'yyyyMMdd_HHmmss_SSS'));

        otherwise
            error('ioHelpers:unknownAction', 'Unknown action: %s', action);
    end
end
