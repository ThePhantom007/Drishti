classdef ReduceMeanLayer1010 < nnet.layer.Layer & nnet.layer.Formattable
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
            this_cg = severity_net.coder.ReduceMeanLayer1010(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net.ReduceMeanLayer1010(cgInstance.Name);
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
        function this = ReduceMeanLayer1010(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_3_38'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_3_38] = predict(this, x_blocks_blocks_3_32__)
            if isdlarray(x_blocks_blocks_3_32__)
                x_blocks_blocks_3_32_ = stripdims(x_blocks_blocks_3_32__);
            else
                x_blocks_blocks_3_32_ = x_blocks_blocks_3_32__;
            end
            x_blocks_blocks_3_32NumDims = 4;
            x_blocks_blocks_3_32 = severity_net.coder.ops.permuteInputVar(x_blocks_blocks_3_32_, [4 3 1 2], 4);

            [x_blocks_blocks_3_38__, x_blocks_blocks_3_38NumDims__] = ReduceMeanGraph1030(this, x_blocks_blocks_3_32, x_blocks_blocks_3_32NumDims, false);
            x_blocks_blocks_3_38_ = severity_net.coder.ops.permuteOutputVar(x_blocks_blocks_3_38__, [3 4 2 1], 4);

            x_blocks_blocks_3_38 = dlarray(single(x_blocks_blocks_3_38_), 'SSCB');
        end

        function [x_blocks_blocks_3_38, x_blocks_blocks_3_38NumDims1032] = ReduceMeanGraph1030(this, x_blocks_blocks_3_32, x_blocks_blocks_3_32NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1020 = severity_net.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1031, coder.const(x_blocks_blocks_3_32NumDims));
            xReduced1021 = mean(x_blocks_blocks_3_32, dims1020);
            x_blocks_blocks_3_38 = xReduced1021;
            x_blocks_blocks_3_38NumDims = coder.const(x_blocks_blocks_3_32NumDims);

            % Set graph output arguments
            x_blocks_blocks_3_38NumDims1032 = coder.const(x_blocks_blocks_3_38NumDims);

        end

    end

end