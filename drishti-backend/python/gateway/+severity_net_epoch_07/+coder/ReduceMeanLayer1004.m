classdef ReduceMeanLayer1004 < nnet.layer.Layer & nnet.layer.Formattable
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
            this_cg = severity_net_epoch_07.coder.ReduceMeanLayer1004(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net_epoch_07.ReduceMeanLayer1004(cgInstance.Name);
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
        function this = ReduceMeanLayer1004(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_1_38'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net_epoch_07.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_1_38] = predict(this, x_blocks_blocks_1_32__)
            if isdlarray(x_blocks_blocks_1_32__)
                x_blocks_blocks_1_32_ = stripdims(x_blocks_blocks_1_32__);
            else
                x_blocks_blocks_1_32_ = x_blocks_blocks_1_32__;
            end
            x_blocks_blocks_1_32NumDims = 4;
            x_blocks_blocks_1_32 = severity_net_epoch_07.coder.ops.permuteInputVar(x_blocks_blocks_1_32_, [4 3 1 2], 4);

            [x_blocks_blocks_1_38__, x_blocks_blocks_1_38NumDims__] = ReduceMeanGraph1012(this, x_blocks_blocks_1_32, x_blocks_blocks_1_32NumDims, false);
            x_blocks_blocks_1_38_ = severity_net_epoch_07.coder.ops.permuteOutputVar(x_blocks_blocks_1_38__, [3 4 2 1], 4);

            x_blocks_blocks_1_38 = dlarray(single(x_blocks_blocks_1_38_), 'SSCB');
        end

        function [x_blocks_blocks_1_38, x_blocks_blocks_1_38NumDims1014] = ReduceMeanGraph1012(this, x_blocks_blocks_1_32, x_blocks_blocks_1_32NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1008 = severity_net_epoch_07.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1013, coder.const(x_blocks_blocks_1_32NumDims));
            xReduced1009 = mean(x_blocks_blocks_1_32, dims1008);
            x_blocks_blocks_1_38 = xReduced1009;
            x_blocks_blocks_1_38NumDims = coder.const(x_blocks_blocks_1_32NumDims);

            % Set graph output arguments
            x_blocks_blocks_1_38NumDims1014 = coder.const(x_blocks_blocks_1_38NumDims);

        end

    end

end