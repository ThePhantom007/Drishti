classdef ReduceMeanLayer1012 < nnet.layer.Layer & nnet.layer.Formattable
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
            this_cg = severity_net.coder.ReduceMeanLayer1012(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net.ReduceMeanLayer1012(cgInstance.Name);
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
        function this = ReduceMeanLayer1012(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_3_68'};
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

        function [x_blocks_blocks_3_68] = predict(this, x_blocks_blocks_3_62__)
            if isdlarray(x_blocks_blocks_3_62__)
                x_blocks_blocks_3_62_ = stripdims(x_blocks_blocks_3_62__);
            else
                x_blocks_blocks_3_62_ = x_blocks_blocks_3_62__;
            end
            x_blocks_blocks_3_62NumDims = 4;
            x_blocks_blocks_3_62 = severity_net.coder.ops.permuteInputVar(x_blocks_blocks_3_62_, [4 3 1 2], 4);

            [x_blocks_blocks_3_68__, x_blocks_blocks_3_68NumDims__] = ReduceMeanGraph1036(this, x_blocks_blocks_3_62, x_blocks_blocks_3_62NumDims, false);
            x_blocks_blocks_3_68_ = severity_net.coder.ops.permuteOutputVar(x_blocks_blocks_3_68__, [3 4 2 1], 4);

            x_blocks_blocks_3_68 = dlarray(single(x_blocks_blocks_3_68_), 'SSCB');
        end

        function [x_blocks_blocks_3_68, x_blocks_blocks_3_68NumDims1038] = ReduceMeanGraph1036(this, x_blocks_blocks_3_62, x_blocks_blocks_3_62NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1024 = severity_net.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1037, coder.const(x_blocks_blocks_3_62NumDims));
            xReduced1025 = mean(x_blocks_blocks_3_62, dims1024);
            x_blocks_blocks_3_68 = xReduced1025;
            x_blocks_blocks_3_68NumDims = coder.const(x_blocks_blocks_3_62NumDims);

            % Set graph output arguments
            x_blocks_blocks_3_68NumDims1038 = coder.const(x_blocks_blocks_3_68NumDims);

        end

    end

end