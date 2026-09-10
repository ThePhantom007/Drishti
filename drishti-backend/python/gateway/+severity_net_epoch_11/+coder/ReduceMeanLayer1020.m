classdef ReduceMeanLayer1020 < nnet.layer.Layer & nnet.layer.Formattable
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
            this_cg = severity_net_epoch_11.coder.ReduceMeanLayer1020(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net_epoch_11.ReduceMeanLayer1020(cgInstance.Name);
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
        function this = ReduceMeanLayer1020(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_5_38'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net_epoch_11.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_5_38] = predict(this, x_blocks_blocks_5_32__)
            if isdlarray(x_blocks_blocks_5_32__)
                x_blocks_blocks_5_32_ = stripdims(x_blocks_blocks_5_32__);
            else
                x_blocks_blocks_5_32_ = x_blocks_blocks_5_32__;
            end
            x_blocks_blocks_5_32NumDims = 4;
            x_blocks_blocks_5_32 = severity_net_epoch_11.coder.ops.permuteInputVar(x_blocks_blocks_5_32_, [4 3 1 2], 4);

            [x_blocks_blocks_5_38__, x_blocks_blocks_5_38NumDims__] = ReduceMeanGraph1060(this, x_blocks_blocks_5_32, x_blocks_blocks_5_32NumDims, false);
            x_blocks_blocks_5_38_ = severity_net_epoch_11.coder.ops.permuteOutputVar(x_blocks_blocks_5_38__, [3 4 2 1], 4);

            x_blocks_blocks_5_38 = dlarray(single(x_blocks_blocks_5_38_), 'SSCB');
        end

        function [x_blocks_blocks_5_38, x_blocks_blocks_5_38NumDims1062] = ReduceMeanGraph1060(this, x_blocks_blocks_5_32, x_blocks_blocks_5_32NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1040 = severity_net_epoch_11.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1061, coder.const(x_blocks_blocks_5_32NumDims));
            xReduced1041 = mean(x_blocks_blocks_5_32, dims1040);
            x_blocks_blocks_5_38 = xReduced1041;
            x_blocks_blocks_5_38NumDims = coder.const(x_blocks_blocks_5_32NumDims);

            % Set graph output arguments
            x_blocks_blocks_5_38NumDims1062 = coder.const(x_blocks_blocks_5_38NumDims);

        end

    end

end