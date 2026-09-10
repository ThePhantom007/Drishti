classdef ReduceMeanLayer1001 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.
    %#codegen

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end

    methods(Static, Hidden)
        % Specify the properties of the class that will not be modified
        % after the first assignment.
        function p = matlabCodegenNontunableProperties(~)
            p = {
                % Constants, i.e., Vars, NumDims and all learnables and states
                'Vars'
                'NumDims'
                };
        end
    end


    methods(Static, Hidden)
        % Instantiate a codegenable layer instance from a MATLAB layer instance
        function this_cg = matlabCodegenToRedirected(mlInstance)
            this_cg = severity_net_epoch_10.coder.ReduceMeanLayer1001(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net_epoch_10.ReduceMeanLayer1001(cgInstance.Name);
            if isstruct(cgInstance.Vars)
                names = fieldnames(cgInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this_ml.Vars.(fieldname) = dlarray(cgInstance.Vars.(fieldname));
                end
            else
                this_ml.Vars = [];
            end
            this_ml.NumDims = cgInstance.NumDims;
        end
    end

    methods
        function this = ReduceMeanLayer1001(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_0_17'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net_epoch_10.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_0_17] = predict(this, x_blocks_blocks_0_12__)
            if isdlarray(x_blocks_blocks_0_12__)
                x_blocks_blocks_0_12_ = stripdims(x_blocks_blocks_0_12__);
            else
                x_blocks_blocks_0_12_ = x_blocks_blocks_0_12__;
            end
            x_blocks_blocks_0_12NumDims = 4;
            x_blocks_blocks_0_12 = severity_net_epoch_10.coder.ops.permuteInputVar(x_blocks_blocks_0_12_, [4 3 1 2], 4);

            [x_blocks_blocks_0_17__, x_blocks_blocks_0_17NumDims__] = ReduceMeanGraph1003(this, x_blocks_blocks_0_12, x_blocks_blocks_0_12NumDims, false);
            x_blocks_blocks_0_17_ = severity_net_epoch_10.coder.ops.permuteOutputVar(x_blocks_blocks_0_17__, [3 4 2 1], 4);

            x_blocks_blocks_0_17 = dlarray(single(x_blocks_blocks_0_17_), 'SSCB');
        end

        function [x_blocks_blocks_0_17, x_blocks_blocks_0_17NumDims1005] = ReduceMeanGraph1003(this, x_blocks_blocks_0_12, x_blocks_blocks_0_12NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1002 = severity_net_epoch_10.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1004, coder.const(x_blocks_blocks_0_12NumDims));
            xReduced1003 = mean(x_blocks_blocks_0_12, dims1002);
            x_blocks_blocks_0_17 = xReduced1003;
            x_blocks_blocks_0_17NumDims = coder.const(x_blocks_blocks_0_12NumDims);

            % Set graph output arguments
            x_blocks_blocks_0_17NumDims1005 = coder.const(x_blocks_blocks_0_17NumDims);

        end

    end

end