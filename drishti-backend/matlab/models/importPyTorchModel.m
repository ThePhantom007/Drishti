function net = importPyTorchModel(onnxPath)
%IMPORTPYTORCHMODEL Import a PyTorch-trained, ONNX-exported model into MATLAB.
%   net = importPyTorchModel('matlab/models/severity_net.onnx')
%
%   Workflow this supports (see python/training/export_onnx.py for the other
%   half): train in PyTorch where iteration speed is highest, export ONNX,
%   import here as a dlnetwork for use in gradeDRSeverity.m / generateGradCAM.m.
%   Requires Deep Learning Toolbox Converter for ONNX Model Format (installable
%   via Add-On Explorer if not already present).

    if ~isfile(onnxPath)
        error('importPyTorchModel:fileNotFound', ...
            'ONNX model not found at %s. Run python/training/export_onnx.py first.', onnxPath);
    end

    if exist('importNetworkFromONNX', 'file') ~= 2 && exist('importONNXNetwork', 'file') ~= 2
        error('importPyTorchModel:converterNotInstalled', ...
            ['Neither importNetworkFromONNX nor importONNXNetwork is available. ' ...
             'This means the "Deep Learning Toolbox Converter for ONNX Model Format" ' ...
             'add-on is not installed -- it is a separate, free add-on, not part of ' ...
             'base Deep Learning Toolbox. Install it via: Home tab -> Add-Ons -> ' ...
             'Get Add-Ons -> search "ONNX" -> install "Deep Learning Toolbox Converter ' ...
             'for ONNX Model Format" -> restart MATLAB (or run clear functions; ' ...
             'rehash path) -> retry.']);
    end

    try
        net = importNetworkFromONNX(onnxPath);
    catch ME
        if strcmp(ME.identifier, 'MATLAB:UndefinedFunction')
            % Older MATLAB versions use importONNXNetwork instead
            net = importONNXNetwork(onnxPath, 'OutputLayerType', 'classification');
        else
            rethrow(ME);
        end
    end

    fprintf('[importPyTorchModel] Loaded %s (%d layers)\n', onnxPath, numel(net.Layers));
end
